import _generate from "@babel/generator";
import _traverse from "@babel/traverse";
import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { parseSource } from "./astAnalysis";

const generate = ((_generate as unknown as { default?: typeof _generate }).default ??
  _generate) as typeof _generate;
const traverse = ((_traverse as unknown as { default?: typeof _traverse }).default ??
  _traverse) as typeof _traverse;

export interface InstrumentPlan {
  kind: "two_pointer" | "bfs";
  leftVar?: string;
  rightVar?: string;
  arrayVar?: string;
  queueVar?: string;
  visitedVar?: string;
}

export interface InstrumentResult {
  code: string;
  /** True if at least one trace call was actually injected. */
  injected: boolean;
}

/**
 * Rewrites the user's source, inserting `__trace(event, actors)` calls into the
 * body of the relevant loop so that running the code emits a step-by-step
 * snapshot stream. Purely syntactic; the `__trace` runtime is supplied by the
 * executor (see instrumentAndExecute).
 */
export function instrumentSource(source: string, plan: InstrumentPlan): InstrumentResult {
  const ast = parseSource(source);
  let injected = false;

  if (plan.kind === "two_pointer") {
    const { leftVar, rightVar, arrayVar } = plan;
    if (!leftVar || !rightVar) return { code: source, injected: false };

    traverse(ast, {
      WhileStatement(path: NodePath<t.WhileStatement>) {
        if (injected) return; // instrument the first matching (outermost) loop only
        if (!testReferences(path.node.test, [leftVar, rightVar])) return;
        const block = ensureBlock(path.get("body"));
        const actors: [string, t.Expression][] = [
          ["left", t.identifier(leftVar)],
          ["right", t.identifier(rightVar)],
        ];
        if (arrayVar) actors.push(["arr", t.identifier(arrayVar)]);
        // One frame per iteration, captured at the top: the pointers as they
        // stand before this step's move.
        block.body.unshift(traceStmt("move_pointer", actors));
        injected = true;
      },
    });
  } else if (plan.kind === "bfs") {
    const { queueVar, visitedVar } = plan;
    if (!queueVar) return { code: source, injected: false };

    traverse(ast, {
      WhileStatement(path: NodePath<t.WhileStatement>) {
        if (injected) return;
        if (!testReferences(path.node.test, [queueVar])) return;
        const block = ensureBlock(path.get("body"));

        const frontActors: [string, t.Expression][] = [
          ["queue", t.identifier(queueVar)],
          // current = front of the queue, i.e. the node about to be dequeued.
          ["current", t.memberExpression(t.identifier(queueVar), t.numericLiteral(0), true)],
        ];
        if (visitedVar) frontActors.push(["visited", t.identifier(visitedVar)]);

        const tailActors: [string, t.Expression][] = [["queue", t.identifier(queueVar)]];
        if (visitedVar) tailActors.push(["visited", t.identifier(visitedVar)]);

        // Frame at entry: which node we're visiting. Frame at exit: queue after
        // this node's neighbors were enqueued.
        block.body.unshift(traceStmt("visit_node", frontActors));
        block.body.push(traceStmt("enqueue", tailActors));
        injected = true;
      },
    });
  }

  if (!injected) return { code: source, injected: false };
  return { code: generate(ast).code, injected: true };
}

// --- helpers ---------------------------------------------------------------

function traceStmt(event: string, actors: [string, t.Expression][]): t.ExpressionStatement {
  const obj = t.objectExpression(
    actors.map(([k, v]) => t.objectProperty(t.identifier(k), v))
  );
  return t.expressionStatement(
    t.callExpression(t.identifier("__trace"), [t.stringLiteral(event), obj])
  );
}

/** Ensure a loop body is a BlockStatement and return it. */
function ensureBlock(bodyPath: NodePath): t.BlockStatement {
  if (bodyPath.isBlockStatement()) return bodyPath.node;
  const block = t.blockStatement([bodyPath.node as t.Statement]);
  bodyPath.replaceWith(block);
  return block;
}

/** True if the loop test mentions any of the given identifier names. */
function testReferences(test: t.Node, names: string[]): boolean {
  let found = false;
  const set = new Set(names);
  const visit = (node: t.Node | null | undefined) => {
    if (!node || found) return;
    if (t.isIdentifier(node) && set.has(node.name)) {
      found = true;
      return;
    }
    for (const key of Object.keys(node)) {
      const val = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(val)) val.forEach((v) => v && t.isNode(v as t.Node) && visit(v as t.Node));
      else if (val && typeof val === "object" && t.isNode(val as t.Node)) visit(val as t.Node);
    }
  };
  visit(test);
  return found;
}
