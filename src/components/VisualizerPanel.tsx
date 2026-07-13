"use client";

import { useEffect, useState } from "react";
import type { VisualizationPayload } from "@/lib/types";
import TraceVisualizer from "./TraceVisualizer";
import DebuggerVisualizer from "./DebuggerVisualizer";

type View = "algorithm" | "debugger";

interface SimCase {
  label: string;
  input: unknown[];
}

export default function VisualizerPanel({
  visualization,
  problemId,
  sourceCode,
  cases,
}: {
  visualization: VisualizationPayload;
  problemId: string;
  sourceCode: string;
  cases: SimCase[];
}) {
  // Local, re-simulatable copy of the payload. Starts as the submit result
  // (which was traced on the first sample) and is replaced when the user picks
  // a different input to simulate.
  const [viz, setViz] = useState(visualization);
  const [selected, setSelected] = useState(0);
  const [simBusy, setSimBusy] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [view, setView] = useState<View>("algorithm");

  // A fresh submission resets everything.
  useEffect(() => {
    setViz(visualization);
    setSelected(0);
    setSimError(null);
  }, [visualization]);

  const hasAlgorithm = !viz.unsupportedReason && viz.trace.length > 0;
  const hasDebugger = (viz.debuggerTrace?.steps.length ?? 0) > 0;
  const effectiveView: View = view === "algorithm" && hasAlgorithm ? "algorithm" : "debugger";

  async function simulate(index: number) {
    if (index === selected && !simError) return;
    const target = cases[index];
    if (!target) return;
    setSelected(index);
    setSimBusy(true);
    setSimError(null);
    try {
      const res = await fetch("/api/visualize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId, sourceCode, input: target.input }),
      });
      const data = await res.json();
      if (!res.ok) setSimError(data.error ?? "Simulation failed");
      else setViz(data.visualization as VisualizationPayload);
    } catch (e) {
      setSimError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSimBusy(false);
    }
  }

  if (!hasAlgorithm && !hasDebugger) {
    return (
      <div className="text-sm text-slate-400">
        {viz.unsupportedReason ?? "No visualization available."}
      </div>
    );
  }

  return (
    <div>
      {/* Which input to simulate */}
      {cases.length > 0 && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <label className="text-xs text-slate-400">Simulate input:</label>
          <select
            value={selected}
            onChange={(e) => simulate(Number(e.target.value))}
            disabled={simBusy}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
          >
            {cases.map((c, i) => (
              <option key={i} value={i}>
                {c.label} — {shortInput(c.input)}
              </option>
            ))}
          </select>
          {simBusy && <span className="text-xs text-slate-400">simulating…</span>}
        </div>
      )}

      {simError && (
        <div className="text-xs text-rose-200 bg-rose-500/10 border border-rose-500/40 rounded-md px-3 py-2 mb-3">
          {simError}
        </div>
      )}

      {/* Algorithm / Step-through toggle */}
      <div className="inline-flex rounded-md border border-slate-700 bg-slate-800/40 p-0.5 mb-4">
        <ViewButton
          active={effectiveView === "algorithm"}
          disabled={!hasAlgorithm}
          onClick={() => setView("algorithm")}
          title={hasAlgorithm ? undefined : "No algorithm pattern was detected for this solution"}
        >
          Algorithm view
        </ViewButton>
        <ViewButton active={effectiveView === "debugger"} disabled={!hasDebugger} onClick={() => setView("debugger")}>
          Step-through
        </ViewButton>
      </div>

      {effectiveView === "algorithm" && hasAlgorithm ? (
        <TraceVisualizer visualization={viz} />
      ) : hasDebugger ? (
        <DebuggerVisualizer trace={viz.debuggerTrace!} />
      ) : (
        <div className="text-sm text-slate-400">{viz.unsupportedReason ?? "No visualization for this view."}</div>
      )}
    </div>
  );
}

function shortInput(input: unknown[]): string {
  try {
    const s = JSON.stringify(input);
    return s.length > 32 ? s.slice(0, 31) + "…" : s;
  } catch {
    return "…";
  }
}

function ViewButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-3 py-1 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        active ? "bg-emerald-600 text-slate-950" : "text-slate-300 hover:text-slate-100"
      }`}
    >
      {children}
    </button>
  );
}
