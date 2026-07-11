import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const difficultyColor: Record<string, string> = {
  Easy: "text-emerald-400",
  Medium: "text-amber-400",
  Hard: "text-rose-400",
};

export default async function HomePage() {
  const [topics, problems] = await Promise.all([
    prisma.topic.findMany({
      orderBy: { ordinal: "asc" },
      include: { _count: { select: { problems: true } } },
    }),
    prisma.problem.findMany({
      orderBy: { createdAt: "asc" },
      include: { topics: { select: { name: true }, orderBy: { ordinal: "asc" } } },
    }),
  ]);

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-10">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Topics</h1>
        <p className="text-slate-400 mb-5 text-sm">
          Pattern-based lists. Pick a topic, or scroll down for every problem. Solve in JavaScript —
          when your solution passes, watch it run.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {topics.map((t) => {
            const empty = t._count.problems === 0;
            return (
              <Link
                key={t.slug}
                href={`/topics/${t.slug}`}
                className={`rounded-lg border px-3 py-3 transition-colors ${
                  empty
                    ? "border-slate-800/70 bg-slate-900/20 hover:bg-slate-900/40"
                    : "border-slate-800 bg-slate-900/40 hover:bg-slate-900/70"
                }`}
              >
                <div className={`text-sm font-medium ${empty ? "text-slate-400" : "text-slate-100"}`}>
                  {t.name}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {t._count.problems} {t._count.problems === 1 ? "problem" : "problems"}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">All problems ({problems.length})</h2>
        <div className="overflow-hidden rounded-xl border border-slate-800 divide-y divide-slate-800">
          {problems.map((p) => (
            <Link
              key={p.id}
              href={`/problems/${p.slug}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-slate-900/60 transition-colors"
            >
              <div>
                <div className="font-medium">{p.title}</div>
                {p.topics.length > 0 && (
                  <div className="text-xs text-slate-400 mt-0.5">{p.topics.map((t) => t.name).join(" · ")}</div>
                )}
              </div>
              <span className={`text-sm font-medium ${difficultyColor[p.difficulty] ?? "text-slate-400"}`}>
                {p.difficulty}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
