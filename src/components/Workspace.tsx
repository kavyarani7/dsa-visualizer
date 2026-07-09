"use client";

import { useState } from "react";
import type { SubmissionStatus, TestRunResult, VisualizationPayload } from "@/lib/types";
import CodeEditor from "./CodeEditor";
import TestResults from "./TestResults";
import VisualizerPanel from "./VisualizerPanel";
import Markdown from "./Markdown";

interface ProblemProps {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  description: string;
  functionName: string;
  patternHint: string;
  starterCode: string;
  totalCases: number;
}

interface RunResponse {
  mode: "run" | "submit";
  status: SubmissionStatus;
  results: TestRunResult[];
  submissionId?: string;
  visualization?: VisualizationPayload;
}

type TabKey = "problem" | "tests" | "visualizer";

export default function Workspace({ problem }: { problem: ProblemProps }) {
  const [code, setCode] = useState(problem.starterCode);
  const [busy, setBusy] = useState<null | "run" | "submit">(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResponse | null>(null);
  const [tab, setTab] = useState<TabKey>("problem");

  const hasVisualization =
    result?.mode === "submit" && result.status === "passed" && !!result.visualization;
  const passedCount = result?.results.filter((r) => r.passed).length ?? 0;

  async function execute(mode: "run" | "submit") {
    setBusy(mode);
    setError(null);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId: problem.id, sourceCode: code, mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Request failed");
        setResult(null);
      } else {
        const run = data as RunResponse;
        setResult(run);
        // Jump to the most relevant tab automatically.
        const showViz =
          run.mode === "submit" && run.status === "passed" && !!run.visualization;
        setTab(showViz ? "visualizer" : "tests");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 grid lg:grid-cols-2 gap-6 items-stretch">
      {/* Left: tabbed panel — Problem · Test Cases · Visualizer */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-800/70">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-slate-100">{problem.title}</h1>
            <span className="text-xs text-slate-300">{problem.difficulty}</span>
          </div>
          <div className="text-xs text-slate-400 mt-1 font-mono">
            function <span className="text-emerald-300">{problem.functionName}</span>(…) ·{" "}
            {problem.totalCases} test cases
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 px-2 border-b border-slate-800 bg-slate-900/40">
          <TabButton active={tab === "problem"} onClick={() => setTab("problem")}>
            Problem
          </TabButton>
          <TabButton active={tab === "tests"} onClick={() => setTab("tests")}>
            Test Cases
            {result && (
              <span
                className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                  result.status === "passed"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-rose-500/20 text-rose-300"
                }`}
              >
                {passedCount}/{result.results.length}
              </span>
            )}
          </TabButton>
          <TabButton active={tab === "visualizer"} onClick={() => setTab("visualizer")}>
            Visualizer
            {hasVisualization && (
              <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 align-middle" />
            )}
          </TabButton>
        </div>

        {/* Tab content */}
        <div className="p-4 flex-1 min-h-[440px]">
          {tab === "problem" && <Markdown>{problem.description}</Markdown>}

          {tab === "tests" &&
            (result ? (
              <TestResults status={result.status} results={result.results} mode={result.mode} />
            ) : (
              <EmptyState>Run or submit your solution to see test results here.</EmptyState>
            ))}

          {tab === "visualizer" &&
            (hasVisualization ? (
              <VisualizerPanel visualization={result!.visualization!} />
            ) : result?.mode === "submit" && result.status !== "passed" ? (
              <EmptyState>
                Your solution didn&apos;t pass every test yet. Fix the failing cases and submit again
                to unlock the animated visualization.
              </EmptyState>
            ) : (
              <EmptyState>
                Submit a correct solution and the detected algorithm will animate here, step by step.
              </EmptyState>
            ))}
        </div>
      </div>

      {/* Right: solution editor panel (mirrors the left panel structure) */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-800/70 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Your Solution</h2>
            <div className="text-xs text-slate-400 mt-1 font-mono">
              write JavaScript · runs in a sandboxed judge
            </div>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full border border-slate-700 bg-slate-800 text-slate-200 whitespace-nowrap">
            JavaScript
          </span>
        </div>

        {/* Editor body — flex-1 so it matches the left panel's height */}
        <div className="p-4 flex-1 min-h-[440px] flex">
          <CodeEditor value={code} onChange={setCode} />
        </div>

        {/* Footer: actions */}
        <div className="px-4 py-3 border-t border-slate-800/70 space-y-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => execute("run")}
              disabled={busy !== null}
              className="px-4 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-medium disabled:opacity-50"
            >
              {busy === "run" ? "Running…" : "Run (samples)"}
            </button>
            <button
              onClick={() => execute("submit")}
              disabled={busy !== null}
              className="px-4 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-semibold disabled:opacity-50"
            >
              {busy === "submit" ? "Submitting…" : "Submit"}
            </button>
            <button
              onClick={() => {
                setCode(problem.starterCode);
                setResult(null);
                setError(null);
                setTab("problem");
              }}
              disabled={busy !== null}
              className="ml-auto px-3 py-1.5 rounded-md text-xs text-slate-300 hover:text-slate-100 disabled:opacity-50"
            >
              Reset code
            </button>
          </div>

          {error && (
            <div className="text-sm text-rose-200 bg-rose-500/10 border border-rose-500/40 rounded-md px-3 py-2">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? "border-emerald-500 text-slate-100"
          : "border-transparent text-slate-400 hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center h-[360px] text-center text-sm text-slate-400 px-6">
      <p className="max-w-sm">{children}</p>
    </div>
  );
}
