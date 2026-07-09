import { Annotation } from "@langchain/langgraph";
import type {
  DebuggerTrace,
  DetectedAlgorithm,
  DetectionMethod,
  TraceEvent,
  VisualActorConfig,
  VisualizationPayload,
} from "@/lib/types";
import type { RawTraceEvent } from "./traceRunner";

/**
 * LangGraph state for the analysis-and-tracing pipeline. Mirrors the spec's
 * PipelineState, plus a few operational channels (functionName, sampleInput,
 * executionOk, payload) the nodes need.
 */
export const PipelineAnnotation = Annotation.Root({
  // --- inputs ---
  submissionId: Annotation<string>,
  problemId: Annotation<string>,
  sourceCode: Annotation<string>,
  functionName: Annotation<string>,
  language: Annotation<"javascript">,
  /** Args for the single representative run we instrument and trace. */
  sampleInput: Annotation<unknown[]>,
  visualActorConfig: Annotation<VisualActorConfig>,

  // --- analysis ---
  astFeatures: Annotation<Record<string, unknown>>,
  detectedAlgorithm: Annotation<DetectedAlgorithm>,
  detectionConfidence: Annotation<number>,
  detectionMethod: Annotation<DetectionMethod>,

  // --- tracing ---
  traceStrategy: Annotation<Record<string, unknown>>,
  rawExecutionTrace: Annotation<RawTraceEvent[]>,
  normalizedTrace: Annotation<TraceEvent[]>,
  /** Whether the most recent instrumented run succeeded (drives retry edge). */
  executionOk: Annotation<boolean>,

  // --- narration & output ---
  explanation: Annotation<string[]>,
  /** Generic step-through trace, produced for every submission. */
  debuggerTrace: Annotation<DebuggerTrace | null>,
  payload: Annotation<VisualizationPayload | null>,

  // --- control ---
  status: Annotation<"analyzing" | "tracing" | "done" | "failed">,
  retryCount: Annotation<number>,
  errors: Annotation<string[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
});

export type PipelineStateType = typeof PipelineAnnotation.State;
export type PipelineUpdate = Partial<PipelineStateType>;
