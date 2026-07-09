import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  // Accept either the cuid or the slug for convenience.
  const problem = await prisma.problem.findFirst({
    where: { OR: [{ id: params.id }, { slug: params.id }] },
    include: {
      testCases: {
        where: { isSample: true },
        orderBy: { ordinal: "asc" },
      },
    },
  });
  if (!problem) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const totalCases = await prisma.testCase.count({ where: { problemId: problem.id } });

  return NextResponse.json({
    problem: {
      id: problem.id,
      slug: problem.slug,
      title: problem.title,
      difficulty: problem.difficulty,
      description: problem.description,
      functionName: problem.functionName,
      patternHint: problem.patternHint,
      starterCode: problem.starterCode,
      totalCases,
      sampleCases: problem.testCases.map((tc) => ({
        ordinal: tc.ordinal,
        input: JSON.parse(tc.inputJson),
        expected: JSON.parse(tc.expectedJson),
      })),
    },
  });
}
