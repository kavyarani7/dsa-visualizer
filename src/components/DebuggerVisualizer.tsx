"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { DebuggerStep, DebuggerTrace, DebuggerLogLine, HeapObject, SerializedValue } from "@/lib/types";
import PlaybackControls from "./PlaybackControls";

interface Arrow {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export default function DebuggerVisualizer({ trace }: { trace: DebuggerTrace }) {
  const steps = trace.steps;
  const total = steps.length;

  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(800);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [arrows, setArrows] = useState<Arrow[]>([]);

  useEffect(() => {
    setStep(0);
    setPlaying(total > 1);
  }, [trace, total]);

  useEffect(() => {
    if (!playing) return;
    if (step >= total - 1) {
      setPlaying(false);
      return;
    }
    timer.current = setTimeout(() => setStep((s) => Math.min(s + 1, total - 1)), speed);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, step, speed, total]);

  const current: DebuggerStep | undefined = steps[Math.min(step, total - 1)];

  // Recompute reference arrows (slot → heap object) after layout settles.
  useLayoutEffect(() => {
    const compute = () => {
      const root = containerRef.current;
      if (!root || !current) {
        setArrows([]);
        return;
      }
      const base = root.getBoundingClientRect();
      const next: Arrow[] = [];
      root.querySelectorAll<HTMLElement>("[data-ref-src]").forEach((src) => {
        const id = src.getAttribute("data-ref-src");
        const target = root.querySelector<HTMLElement>(`[data-heap-id="${id}"]`);
        if (!target) return;
        const s = src.getBoundingClientRect();
        const target_ = target.getBoundingClientRect();
        next.push({
          x1: s.right - base.left,
          y1: s.top + s.height / 2 - base.top,
          x2: target_.left - base.left,
          y2: target_.top + 14 - base.top,
        });
      });
      setArrows(next);
    };
    // Two frames: let flex/grid layout settle before measuring.
    const raf = requestAnimationFrame(() => requestAnimationFrame(compute));
    window.addEventListener("resize", compute);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", compute);
    };
  }, [current, step]);

  if (total === 0) {
    return (
      <div className="text-sm text-zinc-400">
        {trace.note ?? "No step-through was recorded for this program."}
      </div>
    );
  }

  const sourceLines = trace.sourceCode.split("\n");
  const activeLine = current?.lineNo ?? -1;

  // Reveal console output up to (and including) the current step.
  const allLogs = trace.logs ?? [];
  const visibleLogs = allLogs.filter((l) => l.afterStep <= step + 1);

  return (
    <div>
      <div ref={containerRef} className="relative grid lg:grid-cols-2 gap-4">
        {/* SVG arrow overlay spanning the whole viz */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
          <defs>
            <marker id="dbg-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#38bdf8" />
            </marker>
          </defs>
          {arrows.map((a, i) => {
            const dx = Math.max(24, Math.abs(a.x2 - a.x1) * 0.4);
            return (
              <path
                key={i}
                d={`M ${a.x1} ${a.y1} C ${a.x1 + dx} ${a.y1}, ${a.x2 - dx} ${a.y2}, ${a.x2} ${a.y2}`}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={1.5}
                opacity={0.85}
                markerEnd="url(#dbg-arrow)"
              />
            );
          })}
        </svg>

        {/* Source with current line highlighted */}
        <div className="rounded-md border border-zinc-800 bg-zinc-950/60 overflow-hidden text-xs font-mono">
          {sourceLines.map((line, i) => {
            const n = i + 1;
            const active = n === activeLine;
            return (
              <div
                key={i}
                className={`flex ${active ? "bg-emerald-500/15" : ""}`}
              >
                <span
                  className={`select-none w-9 shrink-0 text-right pr-2 py-0.5 ${
                    active ? "text-emerald-300" : "text-zinc-500"
                  }`}
                  style={active ? {} : { color: "#94a3b8" }}
                >
                  {n}
                </span>
                <span className={`pl-2 py-0.5 whitespace-pre ${active ? "text-zinc-100" : "text-zinc-300"}`}>
                  {active ? "▶ " : "  "}
                  {line || " "}
                </span>
              </div>
            );
          })}
        </div>

        {/* Stack + heap */}
        <div className="space-y-4" style={{ zIndex: 10 }}>
          <div>
            <div className="text-[11px] font-semibold text-zinc-400 mb-1.5 uppercase tracking-wide">
              Call stack
            </div>
            <div className="space-y-2">
              {current?.stack.map((frame, i) => {
                const isTop = i === current.stack.length - 1;
                return (
                  <div
                    key={i}
                    className={`rounded-md border px-2.5 py-1.5 ${
                      isTop
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : "border-zinc-700 bg-zinc-800/40"
                    }`}
                  >
                    <div className={`text-[11px] font-mono mb-1 ${isTop ? "text-emerald-300" : "text-zinc-400"}`}>
                      {frame.fn}()
                    </div>
                    {frame.locals.length === 0 ? (
                      <div className="text-[11px] text-zinc-500">no locals</div>
                    ) : (
                      <table className="text-xs font-mono">
                        <tbody>
                          {frame.locals.map((l) => (
                            <tr key={l.name}>
                              <td className="text-sky-300 pr-2 align-top">{l.name}</td>
                              <td className="text-zinc-500 pr-1 align-top">=</td>
                              <td className="align-top">
                                <SlotValue v={l.value} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {current && current.heap.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-zinc-400 mb-1.5 uppercase tracking-wide">
                Objects (heap)
              </div>
              <div className="flex flex-col gap-2">
                {current.heap.map((obj) => (
                  <HeapBox key={obj.id} obj={obj} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {allLogs.length > 0 && (
        <div className="mt-4">
          <div className="text-[11px] font-semibold text-zinc-400 mb-1.5 uppercase tracking-wide">
            Console
            <span className="ml-2 font-normal normal-case tracking-normal text-zinc-500">
              {visibleLogs.length}/{allLogs.length}
            </span>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 max-h-40 overflow-y-auto text-xs font-mono">
            {visibleLogs.length === 0 ? (
              <span className="text-zinc-600">no output yet</span>
            ) : (
              visibleLogs.map((l, i) => <LogRow key={i} log={l} />)
            )}
          </div>
        </div>
      )}

      <div className="mt-3 min-h-[18px] text-xs text-zinc-400 font-mono">
        line {activeLine} · step {step + 1}/{total}
        {trace.note ? ` · ${trace.note}` : ""}
      </div>

      <div className="mt-2">
        <PlaybackControls
          step={step}
          total={total}
          playing={playing}
          speed={speed}
          onPlayPause={() => setPlaying((p) => !p)}
          onStep={(d) => {
            setPlaying(false);
            setStep((s) => Math.max(0, Math.min(total - 1, s + d)));
          }}
          onSeek={(s) => {
            setPlaying(false);
            setStep(s);
          }}
          onReset={() => {
            setPlaying(false);
            setStep(0);
          }}
          onSpeed={setSpeed}
        />
      </div>
    </div>
  );
}

function LogRow({ log }: { log: DebuggerLogLine }) {
  const cls =
    log.level === "error"
      ? "text-rose-300"
      : log.level === "warn"
        ? "text-amber-300"
        : "text-zinc-300";
  return (
    <div className={`whitespace-pre-wrap break-words leading-relaxed ${cls}`}>
      {log.level !== "log" && (
        <span className="mr-1.5 text-[10px] uppercase opacity-60">{log.level}</span>
      )}
      {log.text || " "}
    </div>
  );
}

function SlotValue({ v }: { v: SerializedValue }) {
  if (v.kind === "uninit") return <span className="text-zinc-400 italic">uninitialized</span>;
  if (v.kind === "fn") return <span className="text-sky-300">ƒ {v.name}</span>;
  if (v.kind === "prim") {
    const isString = v.value.startsWith('"');
    const isNullish = v.value === "null" || v.value === "undefined";
    const cls = isNullish ? "text-zinc-400" : isString ? "text-amber-300" : "text-emerald-300";
    return <span className={cls}>{v.value}</span>;
  }
  // reference → anchor for an arrow
  return (
    <span
      data-ref-src={v.id}
      className="inline-flex items-center gap-1 rounded border border-sky-500/50 bg-sky-500/10 px-1 text-[10px] text-sky-300"
      title={`reference to object #${v.id}`}
    >
      ●<span className="text-zinc-400">#{v.id}</span>
    </span>
  );
}

function HeapBox({ obj }: { obj: HeapObject }) {
  return (
    <div
      data-heap-id={obj.id}
      className="rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 w-fit max-w-full"
    >
      <div className="text-[10px] text-zinc-400 mb-1 font-mono">
        {obj.type}
        {obj.length !== undefined ? `(${obj.length})` : ""} #{obj.id}
      </div>
      {obj.type === "array" ? (
        <div className="flex flex-wrap gap-1">
          {obj.entries.map((e) => (
            <div key={e.key} className="flex flex-col items-center">
              <div className="min-w-[28px] px-1.5 py-1 rounded border border-zinc-600 bg-zinc-800/50 text-xs font-mono text-center">
                <SlotValue v={e.value} />
              </div>
              <div className="text-[9px] text-zinc-500 tabular-nums">{e.key}</div>
            </div>
          ))}
          {obj.truncated && <div className="text-[10px] text-zinc-500 self-center">…</div>}
        </div>
      ) : (
        <table className="text-xs font-mono">
          <tbody>
            {obj.entries.map((e) => (
              <tr key={e.key}>
                <td className="text-zinc-300 pr-2 align-top">{e.key}</td>
                <td className="text-zinc-500 pr-1 align-top">:</td>
                <td className="align-top">
                  <SlotValue v={e.value} />
                </td>
              </tr>
            ))}
            {obj.truncated && (
              <tr>
                <td className="text-zinc-500">…</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
