// ---------------------------------------------------------------------------
// Shared domain types. These are the contract between the judge, the LangGraph
// pipeline, and the frontend visualizer. Keep them renderer- and
// language-agnostic so new languages / algorithms are additive.
// ---------------------------------------------------------------------------

export type SupportedLanguage = "javascript";

export type DetectedAlgorithm = "two_pointer" | "bfs" | "unknown";

export type DetectionMethod = "static" | "llm" | "hybrid" | "";

/**
 * A single normalized event in an algorithm run. The visualizer consumes an
 * array of these and is otherwise agnostic to which algorithm produced them.
 */
export interface TraceEvent {
  step: number;
  event: string; // "compare" | "move_pointer" | "visit_node" | "enqueue" | "dequeue" | ...
  /**
   * Snapshot of the logical actors at this step, keyed by role.
   * e.g. { left: 0, right: 5, arr: [...] } for two-pointer, or
   *      { queue: [...], visited: [...], current: 3 } for BFS.
   */
  actors: Record<string, unknown>;
  /** Ids/indices to emphasize for this step. */
  highlight: string[];
  lineNo?: number;
  /** Optional per-step human-readable note (filled by generateExplanation). */
  note?: string;
}

/**
 * How a logical role (e.g. "pointerLeft") is rendered. Designed so richer actor
 * styles ("character", custom sprites) and background pickers are additive.
 */
export interface VisualActorConfig {
  roleMapping: Record<string, string>; // e.g. { left: "arrow", right: "arrow" }
  background: string; // e.g. "plain"
}

export const DEFAULT_ACTOR_CONFIG: VisualActorConfig = {
  roleMapping: {
    left: "arrow",
    right: "arrow",
    current: "marker",
    queue: "queue",
    visited: "visited",
  },
  background: "plain",
};

/**
 * The fully-baked payload the frontend renderer consumes. Produced by the
 * pipeline's mapVisualActors node. Self-contained: the renderer needs nothing
 * else to draw and animate the run.
 */
export interface VisualizationPayload {
  detectedAlgorithm: DetectedAlgorithm;
  detectionConfidence: number;
  detectionMethod: DetectionMethod;
  actorConfig: VisualActorConfig;
  trace: TraceEvent[];
  explanation: string[];
  /** The representative input that was traced; used by the renderer as the
   *  static backdrop (e.g. the grid for BFS). */
  sampleInput?: unknown[];
  /** Present when the pipeline could not produce an algorithm animation. The
   *  step-through debugger view is still available even when this is set. */
  unsupportedReason?: string;
  /** Generic debugger step-through, produced for every successful submission. */
  debuggerTrace?: DebuggerTrace;
}

// ---------------------------------------------------------------------------
// Debugger-style step-through trace ("Python Tutor"-style). Produced by generic
// AST instrumentation and consumed by the DebuggerVisualizer. Works for ANY
// JavaScript program, not just the two detected algorithm patterns.
// ---------------------------------------------------------------------------

export type HeapId = number;

/** A value as it appears in a frame slot or heap entry. */
export type SerializedValue =
  | { kind: "prim"; value: string } // number/string/boolean/null/undefined — display text
  | { kind: "fn"; name: string }
  | { kind: "ref"; id: HeapId } // points at a heap object (draws an arrow)
  | { kind: "uninit" }; // declared but not yet initialized (TDZ)

/** A single object/array/set/map on the heap, referenced by id from slots. */
export interface HeapObject {
  id: HeapId;
  type: "array" | "object" | "set" | "map";
  /** For arrays, `key` is the index. */
  entries: { key: string; value: SerializedValue }[];
  /** Real length for arrays that were truncated for display. */
  length?: number;
  truncated?: boolean;
}

export interface StackFrame {
  fn: string;
  locals: { name: string; value: SerializedValue }[];
}

/** One executed step: the line, the full call stack, and the reachable heap. */
export interface DebuggerStep {
  step: number;
  lineNo: number;
  event: "step" | "call" | "return";
  /** Outermost frame first; the last frame is the currently-executing one. */
  stack: StackFrame[];
  heap: HeapObject[];
}

/** One captured console.* call during the traced run. */
export interface DebuggerLogLine {
  /** Number of steps recorded when this log fired; the UI reveals the line
   *  once the playhead has reached that step (accumulating stdout). */
  afterStep: number;
  level: "log" | "error" | "warn" | "info";
  text: string;
}

export interface DebuggerTrace {
  /** The exact source that was instrumented (rendered line-by-line by the UI). */
  sourceCode: string;
  steps: DebuggerStep[];
  /** console.* output captured during the run, in call order. */
  logs?: DebuggerLogLine[];
  /** Set when tracing produced nothing usable (e.g. a runtime error). */
  note?: string;
}

// --- Judge types (see lib/judge) --------------------------------------------

export interface TestRunResult {
  ordinal: number;
  isSample: boolean;
  input: unknown[];
  expected: unknown;
  actual: unknown;
  passed: boolean;
  stdout: string;
  error: string | null;
  durationMs: number;
  /** True for a user-supplied ("run your own") test case. */
  custom?: boolean;
}

export type SubmissionStatus = "pending" | "passed" | "failed" | "error";
