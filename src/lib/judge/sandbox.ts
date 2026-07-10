// ---------------------------------------------------------------------------
// Low-level JS sandbox. Runs a self-contained program string with a wall-clock
// timeout (and memory limit where the engine supports it). The program is
// expected to assign a JSON string to `globalThis.__out`; the sandbox returns
// that string. This is the ONLY place that touches an execution engine, so the
// engine can be swapped without affecting the judge or the tracing pipeline.
//
// Engine selection is env-controlled (SANDBOX_ENGINE):
//   - "vm" (default): the built-in `vm` module. Stable everywhere. A wall-clock
//     timeout stops runaway synchronous loops. NOT a hard security boundary,
//     but sufficient for local MVP validation of trusted-ish JS.
//   - "isolated-vm": a true memory-limited isolate. Preferred for real
//     deployments, but must be explicitly opted into — isolated-vm 5.x
//     segfaults on Isolate construction with some Node/macOS builds, and a
//     native segfault cannot be caught from JS, so we never load it implicitly.
//
// Both are hidden behind runInSandbox(); callers (judge + tracer) are agnostic.
// ---------------------------------------------------------------------------

export interface SandboxOptions {
  timeoutMs: number;
  memoryLimitMB: number;
}

export interface SandboxResult {
  /** True when the program ran to completion and assigned __out. */
  ok: boolean;
  /** The JSON string the program wrote to globalThis.__out. */
  outJson: string | null;
  /** Set when the sandbox itself failed: timeout, compile error, OOM. */
  sandboxError: string | null;
  engine: "isolated-vm" | "vm";
}

// isolated-vm is an OPTIONAL native addon that may be absent (it isn't installed
// on Vercel, and it segfaults on some local builds). Type it loosely so the
// build never needs its type declarations, and load it purely at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IvmModule = any;

let ivmModule: IvmModule | null | undefined;

function loadIvm(): IvmModule | null {
  // Never load isolated-vm unless explicitly opted in (see header note).
  if (process.env.SANDBOX_ENGINE !== "isolated-vm") return null;
  if (ivmModule !== undefined) return ivmModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ivmModule = require("isolated-vm");
  } catch {
    ivmModule = null;
  }
  return ivmModule ?? null;
}

export function activeEngine(): "isolated-vm" | "vm" {
  return loadIvm() ? "isolated-vm" : "vm";
}

async function runWithIvm(
  source: string,
  opts: SandboxOptions
): Promise<SandboxResult> {
  const ivm = loadIvm()!;
  const isolate = new ivm.Isolate({ memoryLimit: opts.memoryLimitMB });
  try {
    const context = await isolate.createContext();
    // Seed a minimal global (`global`/`globalThis` self-reference).
    await context.global.set("global", context.global.derefInto());
    const script = await isolate.compileScript(source);
    await script.run(context, { timeout: opts.timeoutMs });
    const outJson = await context.global.get("__out", { copy: true });
    return {
      ok: typeof outJson === "string",
      outJson: typeof outJson === "string" ? outJson : null,
      sandboxError: typeof outJson === "string" ? null : "program produced no output",
      engine: "isolated-vm",
    };
  } catch (err) {
    return {
      ok: false,
      outJson: null,
      sandboxError: err instanceof Error ? err.message : String(err),
      engine: "isolated-vm",
    };
  } finally {
    isolate.dispose();
  }
}

function runWithVm(source: string, opts: SandboxOptions): SandboxResult {
  // Fallback path. NOTE: node's `vm` is NOT a security boundary; it is used only
  // when isolated-vm is unavailable so the MVP can still run locally. The
  // timeout stops runaway synchronous loops; there is no hard memory cap here.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const vm = require("vm") as typeof import("vm");
  const sandbox: Record<string, unknown> = {};
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  try {
    vm.runInNewContext(source, sandbox, { timeout: opts.timeoutMs });
    const outJson = sandbox.__out;
    return {
      ok: typeof outJson === "string",
      outJson: typeof outJson === "string" ? (outJson as string) : null,
      sandboxError: typeof outJson === "string" ? null : "program produced no output",
      engine: "vm",
    };
  } catch (err) {
    return {
      ok: false,
      outJson: null,
      sandboxError: err instanceof Error ? err.message : String(err),
      engine: "vm",
    };
  }
}

export async function runInSandbox(
  source: string,
  opts: SandboxOptions
): Promise<SandboxResult> {
  if (loadIvm()) return runWithIvm(source, opts);
  return runWithVm(source, opts);
}
