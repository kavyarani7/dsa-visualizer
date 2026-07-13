import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const difficultyColor: Record<string, string> = {
  Easy: "text-emerald-400",
  Medium: "text-amber-400",
  Hard: "text-rose-400",
};

export default async function TopicPage({ params }: { params: { slug: string } }) {
  const topic = await prisma.topic.findUnique({
    where: { slug: params.slug },
    include: { problems: { orderBy: { createdAt: "asc" } } },
  });
  if (!topic) notFound();

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-8">
      <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← All topics
      </Link>
      <h1 className="text-2xl font-semibold mt-3 mb-1">{topic.name}</h1>
      <p className="text-zinc-400 text-sm mb-6">
        {topic.problems.length} {topic.problems.length === 1 ? "problem" : "problems"}
        {topic.blurb ? ` · ${topic.blurb}` : ""}
      </p>

      {topic.problems.length === 0 ? (
        <div className="text-sm text-zinc-400 bg-zinc-800/40 border border-zinc-700 rounded-md p-4">
          No problems in this list yet. Add one from the admin area.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800 divide-y divide-zinc-800">
          {topic.problems.map((p) => (
            <Link
              key={p.id}
              href={`/problems/${p.slug}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-zinc-800/50 transition-colors"
            >
              <span className="font-medium">{p.title}</span>
              <span className={`text-sm font-medium ${difficultyColor[p.difficulty] ?? "text-zinc-400"}`}>
                {p.difficulty}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
