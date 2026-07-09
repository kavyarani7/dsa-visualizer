import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const patternLabel: Record<string, string> = {
  two_pointer: "Two Pointers",
  bfs: "BFS",
  unknown: "—",
};

const difficultyColor: Record<string, string> = {
  Easy: "text-emerald-400",
  Medium: "text-amber-400",
  Hard: "text-rose-400",
};

export default async function HomePage() {
  const problems = await prisma.problem.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, slug: true, title: true, difficulty: true, patternHint: true },
  });

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-8">
      <h1 className="text-2xl font-semibold mb-1">Problems</h1>
      <p className="text-slate-400 mb-6 text-sm">
        Solve in JavaScript. When your solution passes every test, the site detects the technique
        you used and animates the run.
      </p>

      <div className="overflow-hidden rounded-xl border border-slate-800 divide-y divide-slate-800">
        {problems.map((p) => (
          <Link
            key={p.id}
            href={`/problems/${p.slug}`}
            className="flex items-center justify-between px-4 py-3 hover:bg-slate-900/60 transition-colors"
          >
            <div>
              <div className="font-medium">{p.title}</div>
              <div className="text-xs text-slate-400 mt-0.5">
                Expected technique: {patternLabel[p.patternHint] ?? p.patternHint}
              </div>
            </div>
            <span className={`text-sm font-medium ${difficultyColor[p.difficulty] ?? "text-slate-400"}`}>
              {p.difficulty}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
