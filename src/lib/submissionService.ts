import { prisma } from "./db";
import { getJudge } from "./judge";
import type { JudgeTestCase } from "./judge";
import { runPipeline } from "./pipeline/run";
import type { SubmissionStatus, TestRunResult, VisualizationPayload } from "./types";

export type RunMode = "run" | "submit";

export interface CustomCase {
  input: unknown[];
  expected: unknown;
}

export interface RunOutput {
  mode: RunMode;
  status: SubmissionStatus;
  results: TestRunResult[];
  /** Present only for a persisted "submit" that passed all cases. */
  submissionId?: string;
  visualization?: VisualizationPayload;
}

function toStatus(allPassed: boolean, hadInfraError: boolean): SubmissionStatus {
  if (hadInfraError) return "error";
  return allPassed ? "passed" : "failed";
}

/**
 * Judges a submission and, on a fully-passing "submit", runs the visualization
 * pipeline. The pipeline is only reached after every test passes — an incorrect
 * submission never triggers tracing.
 */
export async function runSubmission(
  problemId: string,
  sourceCode: string,
  mode: RunMode,
  customCases: CustomCase[] = []
): Promise<RunOutput> {
  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    include: { testCases: { orderBy: { ordinal: "asc" } } },
  });
  if (!problem) throw new Error("Problem not found");

  const selected = problem.testCases.filter((tc) => (mode === "run" ? tc.isSample : true));
  const judgeCases: JudgeTestCase[] = selected.map((tc) => ({
    ordinal: tc.ordinal,
    isSample: tc.isSample,
    input: JSON.parse(tc.inputJson) as unknown[],
    expected: JSON.parse(tc.expectedJson) as unknown,
  }));

  // User-supplied cases run in "run" mode only — they never affect the official
  // submit verdict (which is graded against the problem's own hidden tests).
  if (mode === "run") {
    customCases.forEach((c, i) => {
      judgeCases.push({
        ordinal: 1000 + i,
        isSample: true,
        custom: true,
        input: c.input,
        expected: c.expected,
      });
    });
  }

  const judge = getJudge("javascript");
  const judged = await judge.run({
    sourceCode,
    functionName: problem.functionName,
    testCases: judgeCases,
  });

  const status = toStatus(judged.allPassed, judged.hadInfraError);

  // "run" mode is a quick check against sample cases: never persists, never traces.
  if (mode === "run") {
    return { mode, status, results: judged.results };
  }

  // Persist the submission.
  const submission = await prisma.submission.create({
    data: {
      problemId,
      sourceCode,
      language: "javascript",
      status,
      resultsJson: JSON.stringify(judged.results),
    },
  });

  // Only run the tracing pipeline when the solution is fully correct.
  let visualization: VisualizationPayload | undefined;
  if (status === "passed") {
    const firstSample =
      problem.testCases.find((tc) => tc.isSample) ?? problem.testCases[0];
    const sampleInput = firstSample ? (JSON.parse(firstSample.inputJson) as unknown[]) : [];

    visualization = await runPipeline({
      submissionId: submission.id,
      problemId,
      sourceCode,
      functionName: problem.functionName,
      sampleInput,
    });

    await prisma.submission.update({
      where: { id: submission.id },
      data: { pipelineJson: JSON.stringify(visualization) },
    });
  }

  return { mode, status, results: judged.results, submissionId: submission.id, visualization };
}

/**
 * Runs ONLY the visualization pipeline for a given input — no judging, no
 * persistence. Powers the "simulate this test case" selector, so the user can
 * watch the run on any sample or custom input without re-submitting.
 */
export async function visualizeInput(
  problemId: string,
  sourceCode: string,
  input: unknown[]
): Promise<VisualizationPayload> {
  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    select: { id: true, functionName: true },
  });
  if (!problem) throw new Error("Problem not found");

  return runPipeline({
    submissionId: `sim-${Date.now()}`,
    problemId,
    sourceCode,
    functionName: problem.functionName,
    sampleInput: input,
  });
}
