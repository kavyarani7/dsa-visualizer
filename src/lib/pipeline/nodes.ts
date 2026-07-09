import type { TraceEvent, VisualizationPayload } from "@/lib/types";
import { extractFeatures, detect, type AstFeatures } from "./astAnalysis";
import { instrumentSource, type InstrumentPlan } from "./instrument";
import { runInstrumented, type RawTraceEvent } from "./traceRunner";
import { runDebugger } from "./debuggerRunner";
import { llmClassify, llmExplain } from "./llm";
import type { PipelineStateType, PipelineUpdate } from "./state";

export const CONFIDENCE_THRESHOLD = 0.75;
const MAX_RETRIES = 2;

// 1. ingestSubmission -------------------------------------------------------
export async function ingestSubmission(state: PipelineStateType): Promise<PipelineUpdate> {
  return {
    status: "analyzing",
    retryCount: 0,
    executionOk: false,
    normalizedTrace: [],
    explanation: [],
    payload: null,
  };
}

// 2. staticAnalysis ---------------------------------------------------------
export async function staticAnalysis(state: PipelineStateType): Promise<PipelineUpdate> {
  try {
    const features = extractFeatures(state.sourceCode);
    const { algorithm, confidence } = detect(features);
    return {
      astFeatures: features as unknown as Record<string, unknown>,
      detectedAlgorithm: algorithm,
      detectionConfidence: confidence,
      detectionMethod: "static",
    };
  } catch (err) {
    return {
      astFeatures: {},
      detectedAlgorithm: "unknown",
      detectionConfidence: 0,
      detectionMethod: "static",
      errors: [`staticAnalysis: ${err instanceof Error ? err.message : String(err)}`],
    };
  }
}

// 3. classifyAlgorithmLlm ---------------------------------------------------
export async function classifyAlgorithmLlm(state: PipelineStateType): Promise<PipelineUpdate> {
  const result = await llmClassify(state.sourceCode, state.astFeatures);
  if (!result) {
    // No LLM (or it failed) — keep static result, but record that we tried.
    return { detectionMethod: "hybrid" };
  }
  // Trust the LLM only if it is at least as confident as static analysis.
  if (result.confidence >= state.detectionConfidence) {
    return {
      detectedAlgorithm: result.label,
      detectionConfidence: result.confidence,
      detectionMethod: "llm",
    };
  }
  return { detectionMethod: "hybrid" };
}

// 4. selectTraceStrategy ----------------------------------------------------
export async function selectTraceStrategy(state: PipelineStateType): Promise<PipelineUpdate> {
  const f = state.astFeatures as unknown as AstFeatures;
  const algo = state.detectedAlgorithm;

  if (algo === "two_pointer" && f.leftVar && f.rightVar) {
    return {
      traceStrategy: {
        kind: "two_pointer",
        leftVar: f.leftVar,
        rightVar: f.rightVar,
        arrayVar: f.arrayVar,
      },
    };
  }
  if (algo === "bfs" && f.queueVar) {
    return {
      traceStrategy: {
        kind: "bfs",
        queueVar: f.queueVar,
        visitedVar: f.visitedVar,
      },
    };
  }
  return { traceStrategy: { kind: "none" } };
}

// 5. instrumentAndExecute ---------------------------------------------------
export async function instrumentAndExecute(state: PipelineStateType): Promise<PipelineUpdate> {
  const strategy = state.traceStrategy as { kind: string } & Partial<InstrumentPlan>;
  if (strategy.kind !== "two_pointer" && strategy.kind !== "bfs") {
    return { status: "failed", executionOk: false, errors: ["no trace strategy for algorithm"] };
  }

  const plan = strategy as InstrumentPlan;
  const instrumented = instrumentSource(state.sourceCode, plan);
  if (!instrumented.injected) {
    return {
      status: "failed",
      executionOk: false,
      errors: ["could not inject instrumentation (loop not found)"],
    };
  }

  const run = await runInstrumented(instrumented.code, state.functionName, state.sampleInput);

  if (run.sandboxError) {
    return {
      status: "tracing",
      executionOk: false,
      errors: [`sandbox: ${run.sandboxError}`],
    };
  }
  if (run.programError && run.events.length === 0) {
    return {
      status: "failed",
      executionOk: false,
      errors: [`program: ${run.programError}`],
    };
  }
  if (run.events.length === 0) {
    return { status: "failed", executionOk: false, errors: ["instrumented run produced no trace events"] };
  }

  return { status: "tracing", executionOk: true, rawExecutionTrace: run.events };
}

// 6. handleExecutionError ---------------------------------------------------
export async function handleExecutionError(state: PipelineStateType): Promise<PipelineUpdate> {
  return {
    retryCount: state.retryCount + 1,
    errors: [`retry ${state.retryCount + 1} after execution failure`],
  };
}

// 7. normalizeTrace ---------------------------------------------------------
export async function normalizeTrace(state: PipelineStateType): Promise<PipelineUpdate> {
  const raw = state.rawExecutionTrace ?? [];
  const algo = state.detectedAlgorithm;

  // Forward-fill: each raw event updates some actor keys; emit a full snapshot
  // per step so the renderer never has to remember prior frames.
  const running: Record<string, unknown> = {};
  const out: TraceEvent[] = [];

  raw.forEach((ev: RawTraceEvent, i) => {
    for (const [k, v] of Object.entries(ev.actors)) running[k] = hydrate(v);
    const actors = { ...running };
    out.push({
      step: i,
      event: ev.event,
      actors,
      highlight: computeHighlight(algo, ev.event, actors),
      note: describeStep(algo, ev.event, actors),
    });
  });

  return { normalizedTrace: out };
}

// 8. generateExplanation ----------------------------------------------------
export async function generateExplanation(state: PipelineStateType): Promise<PipelineUpdate> {
  const trace = state.normalizedTrace ?? [];
  // Downsample so the LLM sees the shape without a huge payload.
  const sampled = downsample(trace, 12).map((e) => ({ step: e.step, event: e.event, actors: e.actors }));
  const llm = await llmExplain(state.detectedAlgorithm, JSON.stringify(sampled));
  if (llm && llm.length) return { explanation: llm };
  return { explanation: fallbackExplanation(state.detectedAlgorithm, trace) };
}

// 8b. buildDebuggerTrace ----------------------------------------------------
// Universal step: runs generic instrumentation on the submission so EVERY
// solution gets a Python-Tutor-style step-through, independent of whether an
// algorithm pattern was detected.
export async function buildDebuggerTrace(state: PipelineStateType): Promise<PipelineUpdate> {
  const run = await runDebugger(state.sourceCode, state.functionName, state.sampleInput);
  if (run.steps.length === 0) {
    return {
      debuggerTrace: {
        sourceCode: state.sourceCode,
        steps: [],
        note: run.sandboxError ?? run.programError ?? "No steps were recorded for this run.",
      },
    };
  }
  return {
    debuggerTrace: {
      sourceCode: state.sourceCode,
      steps: run.steps,
      note: run.programError
        ? `Program threw after ${run.steps.length} step(s): ${run.programError}`
        : undefined,
    },
  };
}

// 9. mapVisualActors --------------------------------------------------------
export async function mapVisualActors(state: PipelineStateType): Promise<PipelineUpdate> {
  const trace = state.normalizedTrace ?? [];
  const supported = state.detectedAlgorithm === "two_pointer" || state.detectedAlgorithm === "bfs";
  const haveAnimation = supported && trace.length > 0 && state.executionOk;

  const payload: VisualizationPayload = {
    detectedAlgorithm: state.detectedAlgorithm,
    detectionConfidence: state.detectionConfidence,
    detectionMethod: state.detectionMethod,
    actorConfig: state.visualActorConfig,
    trace,
    explanation: state.explanation ?? [],
    sampleInput: state.sampleInput,
    debuggerTrace: state.debuggerTrace ?? undefined,
    unsupportedReason: haveAnimation
      ? undefined
      : supported
        ? "Could not produce a trace for this submission (see pipeline errors)."
        : `No visualization for detected pattern: ${state.detectedAlgorithm}.`,
  };

  return { payload, status: haveAnimation ? "done" : "failed" };
}

// --- edge routers ----------------------------------------------------------

export function afterStaticAnalysis(state: PipelineStateType): "classifyAlgorithmLlm" | "selectTraceStrategy" {
  return state.detectionConfidence < CONFIDENCE_THRESHOLD ? "classifyAlgorithmLlm" : "selectTraceStrategy";
}

export function afterSelectStrategy(state: PipelineStateType): "instrumentAndExecute" | "buildDebuggerTrace" {
  const kind = (state.traceStrategy as { kind?: string })?.kind;
  // Unknown pattern still gets the universal debugger trace.
  return kind === "two_pointer" || kind === "bfs" ? "instrumentAndExecute" : "buildDebuggerTrace";
}

export function afterExecute(
  state: PipelineStateType
): "normalizeTrace" | "handleExecutionError" | "buildDebuggerTrace" {
  if (state.executionOk) return "normalizeTrace";
  if (state.retryCount < MAX_RETRIES) return "handleExecutionError";
  return "buildDebuggerTrace"; // retries exhausted: still emit the debugger trace
}

// --- pure helpers ----------------------------------------------------------

/** Convert sandbox snapshot markers ({__set}, {__map}, {__truncated}) to plain JS. */
function hydrate(v: unknown): unknown {
  if (v === null || typeof v !== "object") return v;
  const obj = v as Record<string, unknown>;
  if (Array.isArray(v)) return v.map(hydrate);
  if ("__set" in obj) return (obj.__set as unknown[]).map(hydrate);
  if ("__map" in obj) return (obj.__map as [unknown, unknown][]).map(([k, val]) => [hydrate(k), hydrate(val)]);
  if ("__truncated" in obj) return [];
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(obj)) out[k] = hydrate(val);
  return out;
}

function computeHighlight(algo: string, event: string, actors: Record<string, unknown>): string[] {
  if (algo === "two_pointer") {
    const h: string[] = [];
    if (typeof actors.left === "number") h.push(`idx:${actors.left}`);
    if (typeof actors.right === "number") h.push(`idx:${actors.right}`);
    return h;
  }
  if (algo === "bfs") {
    if (actors.current !== undefined) return [`cell:${JSON.stringify(actors.current)}`];
  }
  return [];
}

function describeStep(algo: string, event: string, actors: Record<string, unknown>): string {
  if (algo === "two_pointer") {
    // arr may be an array or a string (char pointers); index into both uniformly.
    const arr =
      typeof actors.arr === "string"
        ? (actors.arr as string).split("")
        : Array.isArray(actors.arr)
          ? (actors.arr as unknown[])
          : undefined;
    const l = actors.left as number;
    const r = actors.right as number;
    if (arr && typeof l === "number" && typeof r === "number") {
      return `left=${l} (${fmt(arr[l])}), right=${r} (${fmt(arr[r])})`;
    }
    return `left=${l}, right=${r}`;
  }
  if (algo === "bfs") {
    const q = Array.isArray(actors.queue) ? (actors.queue as unknown[]) : [];
    if (event === "visit_node") return `Visit ${fmt(actors.current)} · queue size ${q.length}`;
    return `Enqueued neighbors · queue size ${q.length}`;
  }
  return event;
}

function fmt(x: unknown): string {
  try {
    return typeof x === "string" ? x : JSON.stringify(x);
  } catch {
    return String(x);
  }
}

function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = arr.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}

function fallbackExplanation(algo: string, trace: TraceEvent[]): string[] {
  if (trace.length === 0) return ["No steps were recorded for this run."];
  if (algo === "two_pointer") {
    return [
      "Two pointers start at opposite ends of the array.",
      "Each step compares the pair and moves one pointer inward based on the comparison.",
      `The pointers converge over ${trace.length} steps until they meet or the answer is found.`,
    ];
  }
  if (algo === "bfs") {
    const visits = trace.filter((t) => t.event === "visit_node").length;
    return [
      "BFS explores outward level by level using a queue.",
      "Each step dequeues the front node, marks it visited, and enqueues its unvisited neighbors.",
      `Across the run, ${visits} node(s) were visited until the queue emptied.`,
    ];
  }
  return ["This run was traced but has no specialized narration."];
}
