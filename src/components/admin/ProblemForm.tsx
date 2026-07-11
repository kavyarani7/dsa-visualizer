"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface TopicOption {
  slug: string;
  name: string;
}

export interface ProblemInitial {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  patternHint: string;
  functionName: string;
  description: string;
  starterCode: string;
  topicSlugs: string[];
  cases: { inputJson: string; expectedJson: string; isSample: boolean }[];
}

interface CaseRow {
  inputJson: string;
  expectedJson: string;
  isSample: boolean;
}

const inputCls =
  "w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500";

export default function ProblemForm({
  topics,
  initial,
}: {
  topics: TopicOption[];
  initial?: ProblemInitial;
}) {
  const router = useRouter();
  const mode = initial ? "edit" : "new";

  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? "Medium");
  const [patternHint, setPatternHint] = useState(initial?.patternHint ?? "unknown");
  const [functionName, setFunctionName] = useState(initial?.functionName ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [starterCode, setStarterCode] = useState(initial?.starterCode ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set(initial?.topicSlugs ?? []));
  const [cases, setCases] = useState<CaseRow[]>(
    initial?.cases?.length
      ? initial.cases
      : [{ inputJson: "", expectedJson: "", isSample: true }]
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTopic(s: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function updateCase(i: number, patch: Partial<CaseRow>) {
    setCases((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      title,
      slug,
      difficulty,
      patternHint,
      functionName,
      description,
      starterCode,
      topics: [...selected],
      cases,
    };
    const url = mode === "edit" ? `/api/admin/problems/${initial!.id}` : "/api/admin/problems";
    try {
      const res = await fetch(url, {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        setError(data.error ?? "Save failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 max-w-3xl">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Title">
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Two Sum II" />
        </Field>
        <Field label="Slug (optional — auto from title)">
          <input className={inputCls} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="two-sum-ii" />
        </Field>
        <Field label="Difficulty">
          <select className={inputCls} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option>Easy</option>
            <option>Medium</option>
            <option>Hard</option>
          </select>
        </Field>
        <Field label="Function name (the judge calls this)">
          <input className={inputCls} value={functionName} onChange={(e) => setFunctionName(e.target.value)} placeholder="twoSum" />
        </Field>
        <Field label="Pattern hint (only two_pointer / bfs get the algorithm animation)">
          <select className={inputCls} value={patternHint} onChange={(e) => setPatternHint(e.target.value)}>
            <option value="unknown">unknown (step-through only)</option>
            <option value="two_pointer">two_pointer</option>
            <option value="bfs">bfs</option>
          </select>
        </Field>
      </div>

      <Field label="Topics (lists this problem appears in)">
        <div className="flex flex-wrap gap-2">
          {topics.map((t) => {
            const on = selected.has(t.slug);
            return (
              <button
                type="button"
                key={t.slug}
                onClick={() => toggleTopic(t.slug)}
                className={`text-xs px-2.5 py-1 rounded-full border ${
                  on
                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-200"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:text-slate-100"
                }`}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Description (markdown)">
        <textarea className={`${inputCls} font-mono min-h-[120px]`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Given an array…" />
      </Field>

      <Field label="Starter code (JavaScript)">
        <textarea className={`${inputCls} font-mono min-h-[160px]`} value={starterCode} onChange={(e) => setStarterCode(e.target.value)} placeholder={"function twoSum(numbers, target) {\n  \n}"} />
      </Field>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-slate-200">Test cases</label>
          <button
            type="button"
            onClick={() => setCases((cs) => [...cs, { inputJson: "", expectedJson: "", isSample: false }])}
            className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
          >
            + Add case
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-2">
          <span className="text-slate-300">input</span> is a JSON array of arguments (e.g.{" "}
          <code className="text-emerald-300">[[2,7,11,15], 9]</code>); <span className="text-slate-300">expected</span> is the JSON return value (e.g.{" "}
          <code className="text-emerald-300">[1,2]</code>).
        </p>
        <div className="space-y-2">
          {cases.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
              <input className={`${inputCls} font-mono text-xs`} value={c.inputJson} onChange={(e) => updateCase(i, { inputJson: e.target.value })} placeholder="[[2,7,11,15], 9]" />
              <input className={`${inputCls} font-mono text-xs`} value={c.expectedJson} onChange={(e) => updateCase(i, { expectedJson: e.target.value })} placeholder="[1,2]" />
              <label className="text-xs text-slate-400 flex items-center gap-1 whitespace-nowrap">
                <input type="checkbox" checked={c.isSample} onChange={(e) => updateCase(i, { isSample: e.target.checked })} className="accent-emerald-500" />
                sample
              </label>
              <button type="button" onClick={() => setCases((cs) => cs.filter((_, j) => j !== i))} className="text-xs text-slate-500 hover:text-rose-300 px-1" title="Remove">
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="text-sm text-rose-200 bg-rose-500/10 border border-rose-500/40 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button type="submit" disabled={busy} className="px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-semibold disabled:opacity-50">
          {busy ? "Saving…" : mode === "edit" ? "Save changes" : "Create problem"}
        </button>
        <button type="button" onClick={() => router.push("/admin")} className="px-3 py-2 rounded-md text-sm text-slate-300 hover:text-slate-100">
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-200 mb-1">{label}</span>
      {children}
    </label>
  );
}
