import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin/auth";
import AdminDashboard from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!isAdmin()) redirect("/admin/login");

  const [topics, problems] = await Promise.all([
    prisma.topic.findMany({
      orderBy: { ordinal: "asc" },
      include: { _count: { select: { problems: true } } },
    }),
    prisma.problem.findMany({
      orderBy: { createdAt: "asc" },
      include: { topics: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-8">
      <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Back to site
      </Link>
      <div className="mt-4">
        <AdminDashboard
          topics={topics.map((t) => ({ slug: t.slug, name: t.name, count: t._count.problems }))}
          problems={problems.map((p) => ({
            id: p.id,
            slug: p.slug,
            title: p.title,
            difficulty: p.difficulty,
            topics: p.topics.map((t) => t.name),
          }))}
        />
      </div>
    </div>
  );
}
