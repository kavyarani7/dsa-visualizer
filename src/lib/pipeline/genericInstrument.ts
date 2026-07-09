import _generate from "@babel/generator";
import _traverse from "@babel/traverse";
import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { parseSource } from "./astAnalysis";

const generate = ((_generate as unknown as { default?: typeof _generate }).default ??
  _generate) as typeof _generate;
const traverse = ((_traverse as unknown as { default?: typeof _traverse }).default ??
  _traverse) as typeof _traverse;

export interface GenericInstrumentResult {
  code: string;
  ok: boolean;
}

/**
 * Rewrites arbitrary JS so that running it emits a step-by-step trace of the
 * call stack and heap — the data a "Python Tutor"-style debugger needs. It is
 * pattern-agnostic: every function is wrapped to track the stack, and a
 * `__step(line, locals)` snapshot is inserted before every statement.
 *
 * The `__step`, `__enter`, `__exit`, `__safe` runtime is supplied by the
 * executor (see debuggerRunner). Line numbers refer to the ORIGINAL source, so
 * the UI can highlight the user's own code.
 */
export function instrumentForDebugger(source: string): GenericInstrumentResult {
  let ast: ReturnType<typeof parseSource>;
  try {
    ast = parseSource(source);
  } catch {
    return { code: source, ok: false };
  }

  // Arrow functions we synthesize for snapshots must never be instrumented.
  const injected = new WeakSet<t.Node>();
  let instrumentedAny = false;

  traverse(ast, {
    // exit → deepest functions first, so a parent wraps already-instrumented children.
    Function: {
      exit(path: NodePath<t.Function>) {
        const node = path.node;
        if (injected.has(node)) return;
        if ((node as unknown as { __dbgDone?: boolean }).__dbgDone) return;

        // Ensure a block body (convert `x => expr` to `x => { return expr; }`).
        if (!t.isBlockStatement(node.body)) {
          node.body = t.blockStatement([t.returnStatement(node.body as t.Expression)]);
        }

        const name = resolveFnName(path);
        const paramNames = node.params.flatMap((p) => namesFromLVal(p as t.Node));

        const body = node.body as t.BlockStatement;
        body.body = instrumentStatementArray(body.body, paramNames, injected);

        // Wrap: __enter(name); try { <body> } finally { __exit(); }
        const enter = call("__enter", [t.stringLiteral(name)]);
        const tryStmt = t.tryStatement(
          t.blockStatement(body.body),
          null,
          t.blockStatement([call("__exit", [])])
        );
        body.body = [enter, tryStmt];
        (node as unknown as { __dbgDone?: boolean }).__dbgDone = true;
        instrumentedAny = true;
      },
    },
  });

  if (!instrumentedAny) return { code: source, ok: false };
  return { code: generate(ast, { retainLines: false }).code, ok: true };
}

// --- statement instrumentation ---------------------------------------------

function instrumentStatementArray(
  stmts: t.Statement[],
  scopeNames: string[],
  injected: WeakSet<t.Node>
): t.Statement[] {
  const scope = unique([...scopeNames, ...collectDeclared(stmts)]);
  const out: t.Statement[] = [];

  for (const stmt of stmts) {
    if (t.isFunctionDeclaration(stmt)) {
      // Instrumented by its own Function visit; hoisted, so no step before it.
      out.push(stmt);
      continue;
    }
    if (stmt.loc) out.push(stepStmt(stmt.loc.start.line, scope, injected));
    instrumentNested(stmt, scope, injected);
    out.push(stmt);
  }
  return out;
}

/** Recurse into a statement's nested blocks (but NOT nested functions). */
function instrumentNested(stmt: t.Statement, scope: string[], injected: WeakSet<t.Node>): void {
  const inst = (block: t.Statement | null | undefined, extra: string[] = []) => {
    if (!block) return null;
    const b = t.isBlockStatement(block) ? block : t.blockStatement([block]);
    b.body = instrumentStatementArray(b.body, unique([...scope, ...extra]), injected);
    return b;
  };

  if (t.isIfStatement(stmt)) {
    stmt.consequent = inst(stmt.consequent)!;
    if (stmt.alternate) {
      // Keep `else if` chains flat rather than wrapping them in a block.
      if (t.isIfStatement(stmt.alternate)) instrumentNested(stmt.alternate, scope, injected);
      else stmt.alternate = inst(stmt.alternate);
    }
  } else if (t.isForStatement(stmt)) {
    const extra = t.isVariableDeclaration(stmt.init)
      ? stmt.init.declarations.flatMap((d) => namesFromLVal(d.id))
      : [];
    stmt.body = inst(stmt.body, extra)!;
  } else if (t.isForInStatement(stmt) || t.isForOfStatement(stmt)) {
    const extra = t.isVariableDeclaration(stmt.left)
      ? stmt.left.declarations.flatMap((d) => namesFromLVal(d.id))
      : [];
    stmt.body = inst(stmt.body, extra)!;
  } else if (t.isWhileStatement(stmt) || t.isDoWhileStatement(stmt)) {
    stmt.body = inst(stmt.body)!;
  } else if (t.isBlockStatement(stmt)) {
    stmt.body = instrumentStatementArray(stmt.body, scope, injected);
  } else if (t.isLabeledStatement(stmt)) {
    instrumentNested(stmt.body, scope, injected);
  } else if (t.isTryStatement(stmt)) {
    stmt.block.body = instrumentStatementArray(stmt.block.body, scope, injected);
    if (stmt.handler) {
      const extra = stmt.handler.param ? namesFromLVal(stmt.handler.param) : [];
      stmt.handler.body.body = instrumentStatementArray(
        stmt.handler.body.body,
        unique([...scope, ...extra]),
        injected
      );
    }
    if (stmt.finalizer) {
      stmt.finalizer.body = instrumentStatementArray(stmt.finalizer.body, scope, injected);
    }
  } else if (t.isSwitchStatement(stmt)) {
    for (const c of stmt.cases) {
      c.consequent = instrumentStatementArray(c.consequent, scope, injected);
    }
  }
}

// --- builders ---------------------------------------------------------------

function stepStmt(line: number, names: string[], injected: WeakSet<t.Node>): t.Statement {
  const props = unique(names).map((name) => {
    // value: __safe(() => name)  — arrow dodges TDZ / ReferenceError.
    const arrow = t.arrowFunctionExpression([], t.identifier(name));
    injected.add(arrow);
    return t.objectProperty(
      t.stringLiteral(name),
      t.callExpression(t.identifier("__safe"), [arrow])
    );
  });
  return call("__step", [t.numericLiteral(line), t.objectExpression(props)]);
}

function call(fn: string, args: t.Expression[]): t.Statement {
  return t.expressionStatement(t.callExpression(t.identifier(fn), args));
}

// --- helpers ----------------------------------------------------------------

function resolveFnName(path: NodePath<t.Function>): string {
  const node = path.node;
  if ((t.isFunctionDeclaration(node) || t.isFunctionExpression(node)) && node.id) return node.id.name;
  const parent = path.parent;
  if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) return parent.id.name;
  if (t.isObjectProperty(parent) && t.isIdentifier(parent.key)) return parent.key.name;
  if (t.isClassMethod(parent) && t.isIdentifier(parent.key)) return parent.key.name;
  if (t.isObjectMethod(node) && t.isIdentifier(node.key)) return node.key.name;
  return "anonymous";
}

/** All identifier names bound by an lval (params / declarator targets). */
function namesFromLVal(node: t.Node): string[] {
  if (t.isIdentifier(node)) return [node.name];
  if (t.isAssignmentPattern(node)) return namesFromLVal(node.left);
  if (t.isRestElement(node)) return namesFromLVal(node.argument);
  if (t.isArrayPattern(node)) return node.elements.flatMap((e) => (e ? namesFromLVal(e) : []));
  if (t.isObjectPattern(node)) {
    return node.properties.flatMap((p) => {
      if (t.isObjectProperty(p)) return namesFromLVal(p.value as t.Node);
      if (t.isRestElement(p)) return namesFromLVal(p.argument);
      return [];
    });
  }
  return [];
}

/** Names declared directly in a statement list (not descending into nested blocks/fns). */
function collectDeclared(stmts: t.Statement[]): string[] {
  const names: string[] = [];
  for (const s of stmts) {
    if (t.isVariableDeclaration(s)) {
      for (const d of s.declarations) names.push(...namesFromLVal(d.id));
    } else if (t.isFunctionDeclaration(s) && s.id) {
      names.push(s.id.name);
    }
  }
  return names;
}

function unique(arr: string[]): string[] {
  return [...new Set(arr)];
}
