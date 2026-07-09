import type { TestRunResult } from "@/lib/types";
import { runInSandbox } from "./sandbox";
import { deepEqual } from "./deepEqual";
import type { Judge, JudgeInput, JudgeOutput, JudgeTestCase } from "./types";

const DEFAULT_TIMEOUT_MS = 2000;
const DEFAULT_MEMORY_MB = 128;

/** Builds a self-contained program that runs the user's function once. */
function buildProgram(sourceCode: string, functionName: string, args: unknown[]): string {
  const argsJson = JSON.stringify(args);
  return `
globalThis.__out = (function () {
  var __logs = [];
  function __fmt(x) { try { return typeof x === 'string' ? x : JSON.stringify(x); } catch (e) { return String(x); } }
  var console = {
    log: function () { __logs.push(Array.prototype.map.call(arguments, __fmt).join(' ')); },
    error: function () { __logs.push(Array.prototype.map.call(arguments, __fmt).join(' ')); },
    warn: function () { __logs.push(Array.prototype.map.call(arguments, __fmt).join(' ')); },
    info: function () { __logs.push(Array.prototype.map.call(arguments, __fmt).join(' ')); }
  };
  try {
    ${sourceCode}
    var __args = ${argsJson};
    if (typeof ${functionName} !== 'function') {
      return JSON.stringify({ ok: false, result: null, logs: __logs, error: 'Function "${functionName}" is not defined.' });
    }
    var __result = ${functionName}.apply(null, __args);
    if (__result === undefined) __result = null;
    return JSON.stringify({ ok: true, result: __result, logs: __logs, error: null });
  } catch (e) {
    return JSON.stringify({ ok: false, result: null, logs: __logs, error: (e && e.message) ? e.message : String(e) });
  }
})();
`;
}

interface ProgramOutput {
  ok: boolean;
  result: unknown;
  logs: string[];
  error: string | null;
}

async function runOne(
  sourceCode: string,
  functionName: string,
  tc: JudgeTestCase,
  timeoutMs: number,
  memoryLimitMB: number
): Promise<{ result: TestRunResult; infraError: boolean }> {
  const start = Date.now();
  const program = buildProgram(sourceCode, functionName, tc.input);
  const sb = await runInSandbox(program, { timeoutMs, memoryLimitMB });
  const durationMs = Date.now() - start;

  if (!sb.ok || sb.outJson === null) {
    return {
      infraError: true,
      result: {
        ordinal: tc.ordinal,
        isSample: tc.isSample,
        input: tc.input,
        expected: tc.expected,
        actual: null,
        passed: false,
        stdout: "",
        error: sb.sandboxError ?? "Execution failed",
        durationMs,
      },
    };
  }

  let parsed: ProgramOutput;
  try {
    parsed = JSON.parse(sb.outJson) as ProgramOutput;
  } catch {
    return {
      infraError: true,
      result: {
        ordinal: tc.ordinal,
        isSample: tc.isSample,
        input: tc.input,
        expected: tc.expected,
        actual: null,
        passed: false,
        stdout: "",
        error: "Could not parse sandbox output",
        durationMs,
      },
    };
  }

  const passed = parsed.ok && deepEqual(parsed.result, tc.expected);
  return {
    infraError: false,
    result: {
      ordinal: tc.ordinal,
      isSample: tc.isSample,
      input: tc.input,
      expected: tc.expected,
      actual: parsed.ok ? parsed.result : null,
      passed,
      stdout: parsed.logs.join("\n"),
      error: parsed.error,
      durationMs,
    },
  };
}

export class JavascriptJudge implements Judge {
  readonly language = "javascript" as const;

  async run(input: JudgeInput): Promise<JudgeOutput> {
    const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const memoryLimitMB = input.memoryLimitMB ?? DEFAULT_MEMORY_MB;

    const results: TestRunResult[] = [];
    let hadInfraError = false;

    // Sequential: keeps isolate memory bounded and results deterministic.
    for (const tc of input.testCases) {
      const { result, infraError } = await runOne(
        input.sourceCode,
        input.functionName,
        tc,
        timeoutMs,
        memoryLimitMB
      );
      results.push(result);
      if (infraError) hadInfraError = true;
    }

    results.sort((a, b) => a.ordinal - b.ordinal);
    return {
      results,
      allPassed: results.length > 0 && results.every((r) => r.passed),
      hadInfraError,
    };
  }
}
