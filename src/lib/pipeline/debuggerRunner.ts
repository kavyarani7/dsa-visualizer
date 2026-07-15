import { runInSandbox } from "@/lib/judge/sandbox";
import type { DebuggerStep, DebuggerLogLine } from "@/lib/types";
import { instrumentForDebugger } from "./genericInstrument";

export interface DebuggerRunResult {
  steps: DebuggerStep[];
  logs: DebuggerLogLine[];
  programError: string | null;
  sandboxError: string | null;
}

// Injected runtime. ES5-ish so it runs under the vm sandbox. Maintains a call
// stack of frames (via __enter/__exit), and on every __step serializes the whole
// stack plus every heap object reachable from it — assigning stable ids by
// object identity so shared references render as arrows. Defensive throughout:
// caps step count, heap breadth, and object size; guards cycles.
const RUNTIME_PRELUDE = `
var __UNINIT = { __uninit: true };
var __stack = [];
var __events = [];
var __logs = [];
var __ids = new WeakMap();
var __nid = 1;
var __MAX_STEPS = 3000;
var __MAX_ENTRIES = 200;
var __MAX_PROPS = 60;
var __MAX_LOGS = 1000;

function __safe(getter) { try { return getter(); } catch (e) { return __UNINIT; } }
function __enter(name) { __stack.push({ fn: name, raw: {}, line: 0 }); }
function __exit() { __stack.pop(); }

function __idOf(obj) {
  var id = __ids.get(obj);
  if (id === undefined) { id = __nid++; __ids.set(obj, id); }
  return id;
}

function __ser(v, pending) {
  if (v === __UNINIT) return { kind: "uninit" };
  if (v === null) return { kind: "prim", value: "null" };
  var tp = typeof v;
  if (tp === "undefined") return { kind: "prim", value: "undefined" };
  if (tp === "number" || tp === "boolean") return { kind: "prim", value: String(v) };
  if (tp === "string") return { kind: "prim", value: JSON.stringify(v) };
  if (tp === "symbol") return { kind: "prim", value: v.toString() };
  if (tp === "function") return { kind: "fn", name: v.name || "anonymous" };
  // object / array / set / map
  var id = __idOf(v);
  pending.push({ id: id, obj: v });
  return { kind: "ref", id: id };
}

function __serObj(id, obj, pending) {
  if (Array.isArray(obj)) {
    var entries = [];
    var cap = Math.min(obj.length, __MAX_ENTRIES);
    for (var i = 0; i < cap; i++) entries.push({ key: String(i), value: __ser(obj[i], pending) });
    return { id: id, type: "array", length: obj.length, truncated: obj.length > cap, entries: entries };
  }
  if (typeof Set !== "undefined" && obj instanceof Set) {
    var se = [], sc = 0;
    obj.forEach(function (x) { if (sc < __MAX_ENTRIES) se.push({ key: String(sc), value: __ser(x, pending) }); sc++; });
    return { id: id, type: "set", truncated: sc > __MAX_ENTRIES, entries: se };
  }
  if (typeof Map !== "undefined" && obj instanceof Map) {
    var me = [], mc = 0;
    obj.forEach(function (val, key) {
      if (mc < __MAX_ENTRIES) me.push({ key: (typeof key === "object" && key !== null) ? "{obj}" : String(key), value: __ser(val, pending) });
      mc++;
    });
    return { id: id, type: "map", truncated: mc > __MAX_ENTRIES, entries: me };
  }
  var oe = [], n = 0;
  for (var k in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      if (n >= __MAX_PROPS) break;
      n++;
      oe.push({ key: k, value: __ser(obj[k], pending) });
    }
  }
  return { id: id, type: "object", entries: oe };
}

function __step(line, rawLocals) {
  if (__stack.length === 0) return;
  var top = __stack[__stack.length - 1];
  top.raw = rawLocals;
  top.line = line;

  var pending = [];
  var stack = [];
  for (var f = 0; f < __stack.length; f++) {
    var fr = __stack[f];
    var locals = [];
    for (var name in fr.raw) {
      if (Object.prototype.hasOwnProperty.call(fr.raw, name)) {
        locals.push({ name: name, value: __ser(fr.raw[name], pending) });
      }
    }
    stack.push({ fn: fr.fn, locals: locals });
  }

  var heap = [];
  var done = {};
  while (pending.length) {
    var item = pending.shift();
    if (done[item.id]) continue;
    done[item.id] = true;
    heap.push(__serObj(item.id, item.obj, pending));
  }

  __events.push({ step: __events.length, lineNo: line, event: "step", stack: stack, heap: heap });
  if (__events.length > __MAX_STEPS) throw new Error("trace exceeded " + __MAX_STEPS + " steps");
}

// Real console: capture each call's text and tag it with how many steps had
// been recorded when it fired, so the UI can reveal output as you step through.
function __logfmt(x) {
  if (typeof x === "string") return x;
  try { return JSON.stringify(x); } catch (e) { return String(x); }
}
function __capture(level) {
  return function () {
    if (__logs.length >= __MAX_LOGS) return;
    __logs.push({
      afterStep: __events.length,
      level: level,
      text: Array.prototype.map.call(arguments, __logfmt).join(" ")
    });
  };
}
var console = { log: __capture("log"), error: __capture("error"), warn: __capture("warn"), info: __capture("info") };
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
    return JSON.stringify({ ok: true, events: __events, logs: __logs, error: null });
  } catch (e) {
    return JSON.stringify({ ok: false, events: __events, logs: __logs, error: (e && e.message) ? e.message : String(e) });
  }
})();
`;
}

export async function runDebugger(
  source: string,
  functionName: string,
  args: unknown[],
  opts: { timeoutMs?: number; memoryLimitMB?: number } = {}
): Promise<DebuggerRunResult> {
  const instrumented = instrumentForDebugger(source);
  if (!instrumented.ok) {
    return { steps: [], logs: [], programError: null, sandboxError: "could not instrument source" };
  }

  const program = buildProgram(instrumented.code, functionName, args);
  const sb = await runInSandbox(program, {
    timeoutMs: opts.timeoutMs ?? 4000,
    memoryLimitMB: opts.memoryLimitMB ?? 256,
  });

  if (!sb.ok || sb.outJson === null) {
    return { steps: [], logs: [], programError: null, sandboxError: sb.sandboxError ?? "execution failed" };
  }

  try {
    const parsed = JSON.parse(sb.outJson) as {
      ok: boolean;
      events: DebuggerStep[];
      logs: DebuggerLogLine[];
      error: string | null;
    };
    return { steps: parsed.events ?? [], logs: parsed.logs ?? [], programError: parsed.error, sandboxError: null };
  } catch {
    return { steps: [], logs: [], programError: null, sandboxError: "could not parse debugger trace" };
  }
}
