"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface TopicRow {
  slug: string;
  name: string;
  count: number;
}
interface ProblemRow {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  topics: string[];
}

export default function AdminDashboard({
  topics,
  problems,
}: {
  topics: TopicRow[];
  problems: ProblemRow[];
}) {
  const router = useRouter();
  const [newTopic, setNewTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function deleteProblem(p: ProblemRow) {
    if (!window.confirm(`Delete "${p.title}"? This removes the problem, its test cases, and submissions. This cannot be undone.`)) {
      return;
    }
    setDeletingId(p.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/problems/${p.id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete problem");
      }
    } catch {
      setError("Network error");
    } finally {
      setDeletingId(null);
    }
  }

  async function addTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!newTopic.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTopic }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNewTopic("");
        router.refresh();
      } else {
        setError(data.error ?? "Failed to add topic");
      }
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <div className="flex items-center gap-3">
          <Link href="/admin/problems/new" className="px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold">
            + New problem
          </Link>
          <button onClick={logout} className="text-sm text-zinc-300 hover:text-zinc-100">
            Sign out
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        {/* Topics */}
        <div className="lg:col-span-1 rounded-xl border border-zinc-800 bg-zinc-800/40 p-4">
          <h2 className="text-sm font-semibold mb-3">Lists / topics ({topics.length})</h2>
          <form onSubmit={addTopic} className="flex gap-2 mb-3">
            <input
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              placeholder="New topic name"
              className="flex-1 rounded-md bg-zinc-800 border border-zinc-700 px-2.5 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
            />
            <button type="submit" disabled={busy} className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-100 disabled:opacity-50">
              Add
            </button>
          </form>
          {error && <div className="text-xs text-rose-300 mb-2">{error}</div>}
          <ul className="divide-y divide-zinc-800/60 text-sm">
            {topics.map((t) => (
              <li key={t.slug} className="flex items-center justify-between py-1.5">
                <Link href={`/topics/${t.slug}`} className="text-zinc-200 hover:text-emerald-300">
                  {t.name}
                </Link>
                <span className="text-xs text-zinc-400 tabular-nums">{t.count}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Problems */}
        <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-800/40 overflow-hidden">
          <h2 className="text-sm font-semibold px-4 pt-4 pb-2">Problems ({problems.length})</h2>
          <ul className="divide-y divide-zinc-800/60">
            {problems.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm text-zinc-100 truncate">{p.title}</div>
                  <div className="text-xs text-zinc-400 truncate">
                    {p.difficulty}
                    {p.topics.length > 0 && <span> · {p.topics.join(", ")}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-xs">
                  <Link href={`/problems/${p.slug}`} className="text-zinc-400 hover:text-zinc-200">
                    view
                  </Link>
                  <Link href={`/admin/problems/${p.id}/edit`} className="text-emerald-400 hover:text-emerald-300">
                    edit
                  </Link>
                  <button
                    onClick={() => deleteProblem(p)}
                    disabled={deletingId === p.id}
                    className="text-rose-400 hover:text-rose-300 disabled:opacity-50"
                  >
                    {deletingId === p.id ? "deleting…" : "delete"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
