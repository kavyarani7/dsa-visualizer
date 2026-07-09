import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import Workspace from "@/components/Workspace";

export const dynamic = "force-dynamic";

export default async function ProblemPage({ params }: { params: { id: string } }) {
  const problem = await prisma.problem.findFirst({
    where: { OR: [{ id: params.id }, { slug: params.id }] },
  });
  if (!problem) notFound();

  const totalCases = await prisma.testCase.count({ where: { problemId: problem.id } });

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-6">
      <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
        ← All problems
      </Link>
      <Workspace
        problem={{
          id: problem.id,
          slug: problem.slug,
          title: problem.title,
          difficulty: problem.difficulty,
          description: problem.description,
          functionName: problem.functionName,
          patternHint: problem.patternHint,
          starterCode: problem.starterCode,
          totalCases,
        }}
      />
    </div>
  );
}
