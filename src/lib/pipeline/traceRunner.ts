import { runInSandbox } from "@/lib/judge/sandbox";

export interface RawTraceEvent {
  step: number;
  event: string;
  actors: Record<string, unknown>;
}

export interface TraceRunResult {
  events: RawTraceEvent[];
  /** Error thrown by the user's (instrumented) code, if any. */
  programError: string | null;
  /** Sandbox-level failure (timeout / engine). */
  sandboxError: string | null;
}

// Injected runtime. Kept ES5-ish so it runs under both engines. `__clone`
// snapshots values defensively: it caps depth/size and guards against cycles so
// a large or self-referential structure can never blow up or hang the trace.
const RUNTIME_PRELUDE = `
var __events = [];
var __step = 0;
function __clone(x, depth, seen) {
  if (depth > 6) return "…";
  if (x === null || typeof x !== "object") return x;
  if (seen.indexOf(x) !== -1) return "[circular]";
  var seen2 = seen.concat([x]);
  if (x instanceof Set) { var sa = []; x.forEach(function (v) { sa.push(__clone(v, depth + 1, seen2)); }); return { __set: sa }; }
  if (x instanceof Map) { var me = []; x.forEach(function (v, k) { me.push([__clone(k, depth + 1, seen2), __clone(v, depth + 1, seen2)]); }); return { __map: me }; }
  if (Array.isArray(x)) { if (x.length > 500) return { __truncated: x.length }; var r = []; for (var i = 0; i < x.length; i++) r.push(__clone(x[i], depth + 1, seen2)); return r; }
  var o = {}; var n = 0; for (var k in x) { if (Object.prototype.hasOwnProperty.call(x, k)) { if (++n > 60) break; o[k] = __clone(x[k], depth + 1, seen2); } } return o;
}
function __trace(event, actors) {
  var snap = {};
  for (var k in actors) { if (Object.prototype.hasOwnProperty.call(actors, k)) snap[k] = __clone(actors[k], 0, []); }
  __events.push({ step: __step++, event: event, actors: snap });
  if (__events.length > 4000) throw new Error("trace exceeded 4000 steps");
}
var console = { log: function () {}, error: function () {}, warn: function () {}, info: function () {} };
`;

function buildProgram(instrumentedCode: string, functionName: string, args: unknown[]): string {
  const argsJson = JSON.stringify(args);
  return `
globalThis.__out = (function () {
  ${RUNTIME_PRELUDE}
  try {
    ${instrumentedCode}
    var __args = ${argsJson};
    if (typeof ${functionName} === "function") {
      ${functionName}.apply(null, __args);
    }
    return JSON.stringify({ ok: true, events: __events, error: null });
  } catch (e) {
    return JSON.stringify({ ok: false, events: __events, error: (e && e.message) ? e.message : String(e) });
  }
})();
`;
}

export async function runInstrumented(
  instrumentedCode: string,
  functionName: string,
  args: unknown[],
  opts: { timeoutMs?: number; memoryLimitMB?: number } = {}
): Promise<TraceRunResult> {
  const program = buildProgram(instrumentedCode, functionName, args);
  const sb = await runInSandbox(program, {
    timeoutMs: opts.timeoutMs ?? 3000,
    memoryLimitMB: opts.memoryLimitMB ?? 256,
  });

  if (!sb.ok || sb.outJson === null) {
    return { events: [], programError: null, sandboxError: sb.sandboxError ?? "execution failed" };
  }

  try {
    const parsed = JSON.parse(sb.outJson) as {
      ok: boolean;
      events: RawTraceEvent[];
      error: string | null;
    };
    return { events: parsed.events ?? [], programError: parsed.error, sandboxError: null };
  } catch {
    return { events: [], programError: null, sandboxError: "could not parse trace output" };
  }
}
