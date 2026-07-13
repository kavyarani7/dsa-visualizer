"use client";

import { useEffect, useState } from "react";
import type { TestRunResult, SubmissionStatus } from "@/lib/types";

function fmt(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** Each argument on its own line — reads like LeetCode's Input panel. */
function fmtInput(input: unknown[]): string {
  return input.map((a) => fmt(a)).join("\n");
}

const statusHead: Record<SubmissionStatus, { label: string; cls: string }> = {
  passed: { label: "Accepted", cls: "text-emerald-400" },
  failed: { label: "Wrong Answer", cls: "text-rose-400" },
  error: { label: "Runtime / Timeout Error", cls: "text-amber-400" },
  pending: { label: "Pending", cls: "text-zinc-300" },
};

function caseLabel(r: TestRunResult): string {
  if (r.custom) return `Custom ${r.ordinal - 999}`;
  return `Case ${r.ordinal + 1}`;
}

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
  const head = statusHead[status];

  // Default to the first failing case (so you see the problem immediately).
  const [sel, setSel] = useState(0);
  useEffect(() => {
    const f = results.findIndex((r) => !r.passed);
    setSel(f >= 0 ? f : 0);
  }, [results]);

  const current = results[Math.min(sel, results.length - 1)];
  if (!current) return null;

  return (
    <div className="rounded-lg border border-zinc-700/70 bg-zinc-800/40">
      {/* Verdict + summary */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-700/60">
        <span className={`text-sm font-semibold ${head.cls}`}>{head.label}</span>
        <span className="text-xs text-zinc-400">
          {passedCount}/{results.length} {mode === "run" ? "sample " : ""}passed
        </span>
      </div>

      {/* Case selector pills */}
      <div className="flex flex-wrap gap-1.5 px-4 py-3 border-b border-zinc-700/60">
        {results.map((r, i) => {
          const active = i === sel;
          return (
            <button
              key={r.ordinal}
              onClick={() => setSel(i)}
              className={[
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors",
                active ? "bg-zinc-700 text-zinc-100" : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-200",
              ].join(" ")}
            >
              <span className={r.passed ? "text-emerald-400" : "text-rose-400"}>●</span>
              {caseLabel(r)}
            </button>
          );
        })}
      </div>

      {/* Selected case detail */}
      <div className="px-4 py-3 space-y-3">
        <Box label="Input" value={fmtInput(current.input)} />
        {current.error ? (
          <Box label="Error" value={current.error} tone="error" />
        ) : (
          <Box label="Output" value={fmt(current.actual)} tone={current.passed ? "ok" : "error"} />
        )}
        <Box label="Expected" value={fmt(current.expected)} tone="expected" />
        {current.stdout && current.stdout.trim().length > 0 && (
          <Box label="Stdout" value={current.stdout} tone="stdout" />
        )}
        <div className="text-[11px] text-zinc-500">
          {caseLabel(current)} · {current.durationMs}ms
          {current.isSample === false && !current.custom ? " · hidden test" : ""}
        </div>
      </div>
    </div>
  );
}

function Box({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "error" | "expected" | "stdout";
}) {
  const valueCls =
    tone === "ok" || tone === "expected"
      ? "text-emerald-300"
      : tone === "error"
        ? "text-rose-300"
        : tone === "stdout"
          ? "text-zinc-300"
          : "text-zinc-100";
  return (
    <div>
      <div className="text-[11px] text-zinc-400 mb-1">{label}</div>
      <pre
        className={`rounded-md bg-zinc-900/70 border border-zinc-700/60 px-3 py-2 text-xs font-mono whitespace-pre-wrap break-words max-h-40 overflow-y-auto ${valueCls}`}
      >
        {value || "—"}
      </pre>
    </div>
  );
}
