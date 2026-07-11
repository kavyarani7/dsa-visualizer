import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin/auth";
import ProblemForm from "@/components/admin/ProblemForm";

export const dynamic = "force-dynamic";

export default async function EditProblemPage({ params }: { params: { id: string } }) {
  if (!isAdmin()) redirect("/admin/login");

  const [topics, problem] = await Promise.all([
    prisma.topic.findMany({ orderBy: { ordinal: "asc" }, select: { slug: true, name: true } }),
    prisma.problem.findUnique({
      where: { id: params.id },
      include: { testCases: { orderBy: { ordinal: "asc" } }, topics: { select: { slug: true } } },
    }),
  ]);
  if (!problem) notFound();

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-8">
      <Link href="/admin" className="text-sm text-slate-400 hover:text-slate-200">
        ← Admin
      </Link>
      <h1 className="text-xl font-semibold mt-4 mb-5">Edit: {problem.title}</h1>
      <ProblemForm
        topics={topics}
        initial={{
          id: problem.id,
          slug: problem.slug,
          title: problem.title,
          difficulty: problem.difficulty,
          patternHint: problem.patternHint,
          functionName: problem.functionName,
          description: problem.description,
          starterCode: problem.starterCode,
          topicSlugs: problem.topics.map((t) => t.slug),
          cases: problem.testCases.map((c) => ({
            inputJson: c.inputJson,
            expectedJson: c.expectedJson,
            isSample: c.isSample,
          })),
        }}
      />
    </div>
  );
}
