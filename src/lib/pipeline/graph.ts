import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { PipelineAnnotation } from "./state";
import {
  ingestSubmission,
  staticAnalysis,
  classifyAlgorithmLlm,
  selectTraceStrategy,
  instrumentAndExecute,
  handleExecutionError,
  normalizeTrace,
  generateExplanation,
  buildDebuggerTrace,
  mapVisualActors,
  afterStaticAnalysis,
  afterSelectStrategy,
  afterExecute,
} from "./nodes";

/**
 * Builds the analysis-and-tracing StateGraph.
 *
 *   ingest → staticAnalysis ─(conf<0.75)→ classifyAlgorithmLlm ┐
 *                            └────────────────────────────────→ selectTraceStrategy
 *   selectTraceStrategy ─(supported)→ instrumentAndExecute      ┐
 *                        └(unknown)──────────────────────────→ mapVisualActors → END
 *   instrumentAndExecute ─(ok)→ normalizeTrace → generateExplanation → mapVisualActors → END
 *                        ├(fail, retries left)→ handleExecutionError → instrumentAndExecute
 *                        └(fail, exhausted)──────────────────────→ mapVisualActors → END
 *
 * A MemorySaver checkpointer persists state between nodes so a transient
 * sandbox failure retries execution without re-running static analysis or the
 * LLM classifier.
 */
export function buildPipelineGraph() {
  const graph = new StateGraph(PipelineAnnotation)
    .addNode("ingestSubmission", ingestSubmission)
    .addNode("staticAnalysis", staticAnalysis)
    .addNode("classifyAlgorithmLlm", classifyAlgorithmLlm)
    .addNode("selectTraceStrategy", selectTraceStrategy)
    .addNode("instrumentAndExecute", instrumentAndExecute)
    .addNode("handleExecutionError", handleExecutionError)
    .addNode("normalizeTrace", normalizeTrace)
    .addNode("generateExplanation", generateExplanation)
    .addNode("buildDebuggerTrace", buildDebuggerTrace)
    .addNode("mapVisualActors", mapVisualActors)
    .addEdge(START, "ingestSubmission")
    .addEdge("ingestSubmission", "staticAnalysis")
    .addConditionalEdges("staticAnalysis", afterStaticAnalysis, [
      "classifyAlgorithmLlm",
      "selectTraceStrategy",
    ])
    .addEdge("classifyAlgorithmLlm", "selectTraceStrategy")
    .addConditionalEdges("selectTraceStrategy", afterSelectStrategy, [
      "instrumentAndExecute",
      "buildDebuggerTrace",
    ])
    .addConditionalEdges("instrumentAndExecute", afterExecute, [
      "normalizeTrace",
      "handleExecutionError",
      "buildDebuggerTrace",
    ])
    .addEdge("handleExecutionError", "instrumentAndExecute")
    .addEdge("normalizeTrace", "generateExplanation")
    .addEdge("generateExplanation", "buildDebuggerTrace")
    .addEdge("buildDebuggerTrace", "mapVisualActors")
    .addEdge("mapVisualActors", END);

  return graph.compile({ checkpointer: new MemorySaver() });
}

// Compile once and reuse.
let compiled: ReturnType<typeof buildPipelineGraph> | null = null;
export function getPipeline() {
  if (!compiled) compiled = buildPipelineGraph();
  return compiled;
}
