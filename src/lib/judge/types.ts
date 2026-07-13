import type { SupportedLanguage, TestRunResult } from "@/lib/types";

export interface JudgeTestCase {
  ordinal: number;
  isSample: boolean;
  input: unknown[]; // positional args passed to the function
  expected: unknown;
  custom?: boolean;
}

export interface JudgeInput {
  sourceCode: string;
  functionName: string;
  testCases: JudgeTestCase[];
  timeoutMs?: number;
  memoryLimitMB?: number;
}

export interface JudgeOutput {
  results: TestRunResult[];
  allPassed: boolean;
  /** True if any case hit a sandbox-level failure (timeout / engine error). */
  hadInfraError: boolean;
}

/**
 * Language-agnostic contract. Adding a new language later means implementing
 * this interface and registering it — no changes to callers or the pipeline.
 */
export interface Judge {
  readonly language: SupportedLanguage;
  run(input: JudgeInput): Promise<JudgeOutput>;
}
