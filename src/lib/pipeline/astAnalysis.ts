import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import type { DetectedAlgorithm } from "@/lib/types";

// @babel/traverse ships as CJS; under ESM/bundlers the callable is on `.default`.
const traverse = ((_traverse as unknown as { default?: typeof _traverse }).default ??
  _traverse) as typeof _traverse;

export interface AstFeatures {
  scopeVars: string[];
  loopCount: number;
  hasWhile: boolean;

  // two-pointer signals
  zeroInitVars: string[];
  lengthInitVars: string[];
  leftVar?: string;
  rightVar?: string;
  arrayVar?: string;
  loopComparesPair: boolean;

  // bfs signals
  queueVar?: string;
  dequeueMethod?: "shift" | "pop";
  visitedVar?: string;
  usesPush: boolean;
  usesShift: boolean;
  usesPop: boolean;
  usesSet: boolean;
  whileOverQueue: boolean;
}

export interface DetectionResult {
  algorithm: DetectedAlgorithm;
  confidence: number;
}

export function parseSource(source: string) {
  return parse(source, {
    sourceType: "script",
    plugins: [],
    errorRecovery: true,
  });
}

/**
 * Static, heuristic feature extraction over the JS AST. Deliberately
 * conservative: it fills in the specific variable names the instrumenter needs
 * for the two supported patterns, and reports a confidence the graph uses to
 * decide whether to fall back to the LLM classifier.
 */
export function extractFeatures(source: string): AstFeatures {
  const ast = parseSource(source);

  const scopeVars = new Set<string>();
  const zeroInitVars: string[] = [];
  const lengthInitVars: string[] = [];
  const lengthObjectOf: Record<string, string> = {}; // var -> array identifier it was sized from

  // identifier -> which array methods were called on it
  const arrMethods: Record<string, Set<string>> = {};
  const setVars = new Set<string>();
  const namedVisited = new Set<string>();

  let loopCount = 0;
  let hasWhile = false;
  let loopComparesPair = false;
  let whileOverQueue = false;

  const noteMethod = (name: string, method: string) => {
    (arrMethods[name] ??= new Set()).add(method);
  };

  traverse(ast, {
    Identifier(path: NodePath<t.Identifier>) {
      scopeVars.add(path.node.name);
    },
    VariableDeclarator(path: NodePath<t.VariableDeclarator>) {
      const id = path.node.id;
      const init = path.node.init;
      if (!t.isIdentifier(id) || !init) return;
      const name = id.name;
      if (/visit|seen|explored/i.test(name)) namedVisited.add(name);

      if (t.isNumericLiteral(init) && init.value === 0) zeroInitVars.push(name);

      // right = arr.length - 1  |  right = arr.length
      const arrOfLength = findLengthArray(init);
      if (arrOfLength) {
        lengthInitVars.push(name);
        lengthObjectOf[name] = arrOfLength;
      }

      if (t.isNewExpression(init) && t.isIdentifier(init.callee) && init.callee.name === "Set") {
        setVars.add(name);
      }
      // queue = [] or [start]
      if (t.isArrayExpression(init)) {
        // no-op; method usage below decides if it's a queue
      }
    },
    CallExpression(path: NodePath<t.CallExpression>) {
      const callee = path.node.callee;
      if (t.isMemberExpression(callee) && t.isIdentifier(callee.object) && t.isIdentifier(callee.property)) {
        noteMethod(callee.object.name, callee.property.name);
      }
    },
    "WhileStatement|ForStatement": {
      enter(path: NodePath) {
        loopCount += 1;
        if (path.isWhileStatement()) {
          hasWhile = true;
          const test = path.node.test;
          if (comparesTwoIdentifiers(test)) loopComparesPair = true;
          if (referencesQueueLength(test)) whileOverQueue = true;
        }
      },
    },
  });

  // --- resolve two-pointer pair -------------------------------------------
  let leftVar: string | undefined;
  let rightVar: string | undefined;
  let arrayVar: string | undefined;
  if (loopComparesPair) {
    // Prefer a zero-init var as left and a length-init var as right.
    leftVar = zeroInitVars[0];
    rightVar = lengthInitVars[0];
    if (rightVar) arrayVar = lengthObjectOf[rightVar];
  }

  // --- resolve queue / visited --------------------------------------------
  let queueVar: string | undefined;
  let dequeueMethod: "shift" | "pop" | undefined;
  for (const [name, methods] of Object.entries(arrMethods)) {
    if (methods.has("push") && (methods.has("shift") || methods.has("pop"))) {
      queueVar = name;
      dequeueMethod = methods.has("shift") ? "shift" : "pop";
      break;
    }
  }
  const visitedVar = setVars.values().next().value ?? namedVisited.values().next().value;

  const usesPush = Object.values(arrMethods).some((m) => m.has("push"));
  const usesShift = Object.values(arrMethods).some((m) => m.has("shift"));
  const usesPop = Object.values(arrMethods).some((m) => m.has("pop"));

  return {
    scopeVars: [...scopeVars],
    loopCount,
    hasWhile,
    zeroInitVars,
    lengthInitVars,
    leftVar,
    rightVar,
    arrayVar,
    loopComparesPair,
    queueVar,
    dequeueMethod,
    visitedVar,
    usesPush,
    usesShift,
    usesPop,
    usesSet: setVars.size > 0,
    whileOverQueue,
  };
}

export function detect(f: AstFeatures): DetectionResult {
  // Two-pointer: two converging indices compared in a loop.
  if (f.leftVar && f.rightVar && f.loopComparesPair) {
    return { algorithm: "two_pointer", confidence: 0.9 };
  }

  // BFS: a queue (push + shift/pop) driving a while loop, plus a visited marker.
  if (f.queueVar && f.whileOverQueue && f.visitedVar) {
    return { algorithm: "bfs", confidence: 0.9 };
  }
  if (f.queueVar && f.whileOverQueue) {
    return { algorithm: "bfs", confidence: 0.7 };
  }

  // Weaker two-pointer signal: pair of index vars but loop shape unclear.
  if (f.zeroInitVars.length && f.lengthInitVars.length) {
    return { algorithm: "two_pointer", confidence: 0.55 };
  }

  return { algorithm: "unknown", confidence: 0.3 };
}

// --- helpers ---------------------------------------------------------------

/** If expr is `X.length` or `X.length - k`, return X's identifier name. */
function findLengthArray(expr: t.Node): string | undefined {
  if (
    t.isMemberExpression(expr) &&
    t.isIdentifier(expr.property) &&
    expr.property.name === "length" &&
    t.isIdentifier(expr.object)
  ) {
    return expr.object.name;
  }
  if (t.isBinaryExpression(expr)) {
    return findLengthArray(expr.left) ?? (t.isExpression(expr.right) ? findLengthArray(expr.right) : undefined);
  }
  return undefined;
}

/** True for tests like `left < right`, `i <= j` (two bare identifiers). */
function comparesTwoIdentifiers(test: t.Node): boolean {
  return (
    t.isBinaryExpression(test) &&
    ["<", "<=", ">", ">="].includes(test.operator) &&
    t.isIdentifier(test.left) &&
    t.isIdentifier(test.right)
  );
}

/** True for tests referencing `<something>.length` (e.g. `queue.length`). */
function referencesQueueLength(test: t.Node): boolean {
  let found = false;
  const visit = (node: t.Node | null | undefined) => {
    if (!node || found) return;
    if (
      t.isMemberExpression(node) &&
      t.isIdentifier(node.property) &&
      node.property.name === "length"
    ) {
      found = true;
      return;
    }
    for (const key of Object.keys(node)) {
      const val = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(val)) val.forEach((v) => t.isNode(v as t.Node) && visit(v as t.Node));
      else if (val && typeof val === "object" && t.isNode(val as t.Node)) visit(val as t.Node);
    }
  };
  visit(test);
  return found;
}
