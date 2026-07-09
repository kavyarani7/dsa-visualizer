"use client";

import { useState } from "react";
import type { VisualizationPayload } from "@/lib/types";
import TraceVisualizer from "./TraceVisualizer";
import DebuggerVisualizer from "./DebuggerVisualizer";

type View = "algorithm" | "debugger";

export default function VisualizerPanel({ visualization }: { visualization: VisualizationPayload }) {
  const hasAlgorithm = !visualization.unsupportedReason && visualization.trace.length > 0;
  const hasDebugger = (visualization.debuggerTrace?.steps.length ?? 0) > 0;

  const [view, setView] = useState<View>(hasAlgorithm ? "algorithm" : "debugger");

  // Nothing to show at all (shouldn't happen for a passing submission).
  if (!hasAlgorithm && !hasDebugger) {
    return (
      <div className="text-sm text-slate-400">
        {visualization.unsupportedReason ?? "No visualization available."}
      </div>
    );
  }

  return (
    <div>
      <div className="inline-flex rounded-md border border-slate-700 bg-slate-800/40 p-0.5 mb-4">
        <ViewButton
          active={view === "algorithm"}
          disabled={!hasAlgorithm}
          onClick={() => setView("algorithm")}
          title={hasAlgorithm ? undefined : "No algorithm pattern was detected for this solution"}
        >
          Algorithm view
        </ViewButton>
        <ViewButton active={view === "debugger"} disabled={!hasDebugger} onClick={() => setView("debugger")}>
          Step-through
        </ViewButton>
      </div>

      {view === "algorithm" && hasAlgorithm ? (
        <TraceVisualizer visualization={visualization} />
      ) : hasDebugger ? (
        <DebuggerVisualizer trace={visualization.debuggerTrace!} />
      ) : (
        <div className="text-sm text-slate-400">
          {visualization.unsupportedReason ?? "No visualization for this view."}
        </div>
      )}
    </div>
  );
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
