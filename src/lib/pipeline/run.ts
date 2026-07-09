import { DEFAULT_ACTOR_CONFIG, type VisualActorConfig, type VisualizationPayload } from "@/lib/types";
import { getPipeline } from "./graph";

export interface RunPipelineArgs {
  submissionId: string;
  problemId: string;
  sourceCode: string;
  functionName: string;
  /** Positional args for the representative run to trace. */
  sampleInput: unknown[];
  visualActorConfig?: VisualActorConfig;
}

/**
 * Runs the full analysis-and-tracing pipeline for one submission and returns the
 * renderer-ready visualization payload. Never throws — any internal failure is
 * surfaced as an `unsupportedReason` on the payload.
 */
export async function runPipeline(args: RunPipelineArgs): Promise<VisualizationPayload> {
  const pipeline = getPipeline();
  const actorConfig = args.visualActorConfig ?? DEFAULT_ACTOR_CONFIG;

  try {
    const final = await pipeline.invoke(
      {
        submissionId: args.submissionId,
        problemId: args.problemId,
        sourceCode: args.sourceCode,
        functionName: args.functionName,
        language: "javascript",
        sampleInput: args.sampleInput,
        visualActorConfig: actorConfig,
        detectedAlgorithm: "unknown",
        detectionConfidence: 0,
        detectionMethod: "",
        traceStrategy: {},
        rawExecutionTrace: [],
        normalizedTrace: [],
        explanation: [],
        debuggerTrace: null,
        status: "analyzing",
        retryCount: 0,
        executionOk: false,
        payload: null,
      },
      { configurable: { thread_id: args.submissionId }, recursionLimit: 50 }
    );

    if (final.payload) return final.payload;
    return {
      detectedAlgorithm: final.detectedAlgorithm ?? "unknown",
      detectionConfidence: final.detectionConfidence ?? 0,
      detectionMethod: final.detectionMethod ?? "",
      actorConfig,
      trace: final.normalizedTrace ?? [],
      explanation: final.explanation ?? [],
      unsupportedReason: "Pipeline finished without producing a payload.",
    };
  } catch (err) {
    return {
      detectedAlgorithm: "unknown",
      detectionConfidence: 0,
      detectionMethod: "",
      actorConfig,
      trace: [],
      explanation: [],
      unsupportedReason: `Pipeline error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
