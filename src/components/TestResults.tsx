"use client";

import type { TestRunResult, SubmissionStatus } from "@/lib/types";

function fmt(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

const statusBadge: Record<SubmissionStatus, { label: string; cls: string }> = {
  passed: { label: "Accepted", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  failed: { label: "Wrong Answer", cls: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  error: { label: "Runtime / Timeout Error", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  pending: { label: "Pending", cls: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
};

export default function TestResults({
  status,
  results,
  mode,
}: {
  status: SubmissionStatus;
  results: TestRunResult[];
  mode: "run" | "submit";
}) {
  const passedCount = results.filter((r) => r.passed).length;
  const badge = statusBadge[status];

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800">
        <span className={`text-xs font-medium px-2 py-0.5 rounded border ${badge.cls}`}>
          {badge.label}
        </span>
        <span className="text-xs text-slate-400">
          {passedCount}/{results.length} {mode === "run" ? "sample" : ""} tests passed
        </span>
      </div>
      <ul className="divide-y divide-slate-800/60 max-h-56 overflow-y-auto">
        {results.map((r) => (
          <li key={r.ordinal} className="px-4 py-2 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className={r.passed ? "text-emerald-400" : "text-rose-400"}>
                {r.passed ? "✓" : "✗"}
              </span>
              <span className="text-slate-400">
                Case {r.ordinal + 1} {r.isSample ? "" : "(hidden)"} · {r.durationMs}ms
              </span>
            </div>
            {!r.passed && (
              <div className="mt-1 ml-5 space-y-0.5 text-slate-400">
                <div>
                  <span className="text-slate-400">input:</span> {fmt(r.input)}
                </div>
                <div>
                  <span className="text-slate-400">expected:</span>{" "}
                  <span className="text-emerald-300">{fmt(r.expected)}</span>
                </div>
                <div>
                  <span className="text-slate-400">got:</span>{" "}
                  <span className="text-rose-300">{r.error ? `Error: ${r.error}` : fmt(r.actual)}</span>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
