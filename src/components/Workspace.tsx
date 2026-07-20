"use client";

import { useState } from "react";
import Link from "next/link";
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
  topics: { slug: string; name: string }[];
  sampleCases: { input: unknown[]; expected: unknown }[];
}

interface CustomCase {
  inputJson: string;
  expectedJson: string;
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
  const [busy, setBusy] = useState<null | "run" | "submit" | "debug">(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResponse | null>(null);
  const [tab, setTab] = useState<TabKey>("problem");
  const [customCases, setCustomCases] = useState<CustomCase[]>([]);
  // On-demand debug session: step through the CURRENT code against a chosen
  // input regardless of whether it passes. Independent of submissions.
  const [debugViz, setDebugViz] = useState<VisualizationPayload | null>(null);
  const [debugCase, setDebugCase] = useState(0);

  const hasVisualization =
    result?.mode === "submit" && result.status === "passed" && !!result.visualization;
  const passedCount = result?.results.filter((r) => r.passed).length ?? 0;

  // Inputs the visualizer can simulate: every sample case, plus any custom case
  // whose input is valid JSON.
  const simCases: { label: string; input: unknown[] }[] = [
    ...problem.sampleCases.map((c, i) => ({ label: `Sample ${i + 1}`, input: c.input })),
    ...customCases
      .map((c, i) => {
        try {
          const parsed = JSON.parse(c.inputJson);
          return Array.isArray(parsed) ? { label: `Custom ${i + 1}`, input: parsed as unknown[] } : null;
        } catch {
          return null;
        }
      })
      .filter((x): x is { label: string; input: unknown[] } => x !== null),
  ];

  // Step through the current code against a chosen input, pass or fail.
  async function debug(index: number) {
    const target = simCases[index];
    if (!target) return;
    setBusy("debug");
    setError(null);
    setDebugCase(index);
    try {
      const res = await fetch("/api/visualize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId: problem.id, sourceCode: code, input: target.input }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Debug failed");
      } else {
        setDebugViz(data.visualization as VisualizationPayload);
        setTab("visualizer");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(null);
    }
  }

  async function execute(mode: "run" | "submit") {
    setBusy(mode);
    setError(null);
    setDebugViz(null);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId: problem.id, sourceCode: code, mode, customCases }),
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
      <div className="rounded-xl border border-zinc-800 bg-zinc-800/40 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-zinc-800/70">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-zinc-100">{problem.title}</h1>
            <span className="text-xs text-zinc-300">{problem.difficulty}</span>
          </div>
          <div className="text-xs text-zinc-400 mt-1 font-mono">
            function <span className="text-emerald-300">{problem.functionName}</span>(…) ·{" "}
            {problem.totalCases} test cases
          </div>
          {problem.topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {problem.topics.map((t) => (
                <Link
                  key={t.slug}
                  href={`/topics/${t.slug}`}
                  className="text-[11px] px-2 py-0.5 rounded-full border border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-emerald-500/50 hover:text-emerald-300 transition-colors"
                >
                  {t.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 px-2 border-b border-zinc-800 bg-zinc-800/40">
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

          {tab === "tests" && (
            <div className="space-y-4">
              <SampleCasesList cases={problem.sampleCases} />
              <CustomCasesEditor cases={customCases} onChange={setCustomCases} />
              {result ? (
                <TestResults status={result.status} results={result.results} mode={result.mode} />
              ) : (
                <div className="text-sm text-zinc-400">
                  Run your solution to see results (samples{customCases.length ? " + your custom cases" : ""}).
                </div>
              )}
            </div>
          )}

          {tab === "visualizer" &&
            (debugViz ? (
              <VisualizerPanel
                visualization={debugViz}
                problemId={problem.id}
                sourceCode={code}
                cases={simCases}
                initialView="debugger"
                initialCase={debugCase}
              />
            ) : hasVisualization ? (
              <VisualizerPanel
                visualization={result!.visualization!}
                problemId={problem.id}
                sourceCode={code}
                cases={simCases}
              />
            ) : (
              <EmptyState>
                Hit <span className="text-zinc-200 font-medium">Debug</span> to step through your
                current code line by line — call stack, variables and console, on any input, pass or
                fail. Or submit a correct solution to unlock the animated algorithm view.
              </EmptyState>
            ))}
        </div>
      </div>

      {/* Right: solution editor panel (mirrors the left panel structure) */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-800/40 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-zinc-800/70 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Your Solution</h2>
            <div className="text-xs text-zinc-400 mt-1 font-mono">
              write JavaScript · runs in a sandboxed judge
            </div>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full border border-zinc-700 bg-zinc-800 text-zinc-200 whitespace-nowrap">
            JavaScript
          </span>
        </div>

        {/* Editor body — flex-1 so it matches the left panel's height */}
        <div className="p-4 flex-1 min-h-[440px] flex">
          <CodeEditor value={code} onChange={setCode} />
        </div>

        {/* Footer: actions */}
        <div className="px-4 py-3 border-t border-zinc-800/70 space-y-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => execute("run")}
              disabled={busy !== null}
              className="px-4 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-medium disabled:opacity-50"
            >
              {busy === "run" ? "Running…" : "Run (samples)"}
            </button>
            <button
              onClick={() => execute("submit")}
              disabled={busy !== null}
              className="px-4 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold disabled:opacity-50"
            >
              {busy === "submit" ? "Submitting…" : "Submit"}
            </button>
            <button
              onClick={() => debug(debugCase)}
              disabled={busy !== null || simCases.length === 0}
              title={simCases.length === 0 ? "No input available to debug" : "Step through your code"}
              className="px-4 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-zinc-50 text-sm font-medium disabled:opacity-50"
            >
              {busy === "debug" ? "Tracing…" : "Debug"}
            </button>
            <button
              onClick={() => {
                setCode(problem.starterCode);
                setResult(null);
                setDebugViz(null);
                setError(null);
                setTab("problem");
              }}
              disabled={busy !== null}
              className="ml-auto px-3 py-1.5 rounded-md text-xs text-zinc-300 hover:text-zinc-100 disabled:opacity-50"
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
          ? "border-emerald-500 text-zinc-100"
          : "border-transparent text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center h-[360px] text-center text-sm text-zinc-400 px-6">
      <p className="max-w-sm">{children}</p>
    </div>
  );
}

function fmtVal(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function SampleCasesList({ cases }: { cases: { input: unknown[]; expected: unknown }[] }) {
  if (cases.length === 0) return null;
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-800/40 p-3">
      <div className="text-xs font-semibold text-zinc-300 uppercase tracking-wide mb-2">
        Sample test cases
      </div>
      <div className="space-y-2">
        {cases.map((c, i) => (
          <div key={i} className="text-xs font-mono">
            <div className="text-zinc-400 mb-0.5">Sample {i + 1}</div>
            <div className="ml-3 space-y-0.5">
              <div>
                <span className="text-zinc-500">input:</span>{" "}
                <span className="text-zinc-200">{fmtVal(c.input)}</span>
              </div>
              <div>
                <span className="text-zinc-500">expected:</span>{" "}
                <span className="text-emerald-300">{fmtVal(c.expected)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const caseInputCls =
  "w-full rounded bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-xs font-mono text-zinc-100 focus:outline-none focus:border-emerald-500";

function CustomCasesEditor({
  cases,
  onChange,
}: {
  cases: { inputJson: string; expectedJson: string }[];
  onChange: (c: { inputJson: string; expectedJson: string }[]) => void;
}) {
  const update = (i: number, patch: Partial<{ inputJson: string; expectedJson: string }>) =>
    onChange(cases.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-800/40 p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">Your test cases</span>
        <button
          onClick={() => onChange([...cases, { inputJson: "", expectedJson: "" }])}
          disabled={cases.length >= 20}
          className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-40"
        >
          + Add case
        </button>
      </div>
      <p className="text-[11px] text-zinc-400 mb-2">
        Anyone can add cases here — they run when you hit <span className="text-zinc-300">Run</span>, and appear
        in the Visualizer&apos;s input picker. <span className="text-zinc-300">input</span> is a JSON array of
        arguments (e.g. <code className="text-emerald-300">[[2,7,11,15], 9]</code>).
      </p>
      {cases.length === 0 ? (
        <div className="text-[11px] text-zinc-500">No custom cases yet.</div>
      ) : (
        <div className="space-y-1.5">
          {cases.map((c, i) => (
            <div key={i} className="grid grid-cols-[auto_1fr_1fr_auto] gap-1.5 items-center">
              <span className="text-[10px] text-zinc-500 w-12">Custom {i + 1}</span>
              <input
                className={caseInputCls}
                value={c.inputJson}
                onChange={(e) => update(i, { inputJson: e.target.value })}
                placeholder="input e.g. [[2,7,11,15], 9]"
              />
              <input
                className={caseInputCls}
                value={c.expectedJson}
                onChange={(e) => update(i, { expectedJson: e.target.value })}
                placeholder="expected e.g. [1,2]"
              />
              <button
                onClick={() => onChange(cases.filter((_, j) => j !== i))}
                className="text-xs text-zinc-500 hover:text-rose-300 px-1"
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
