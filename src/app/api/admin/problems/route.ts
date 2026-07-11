import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin/auth";
import { parseProblemInput, type RawProblem } from "@/lib/admin/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: RawProblem;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = parseProblemInput(raw);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const d = parsed.data;

  const clash = await prisma.problem.findUnique({ where: { slug: d.slug } });
  if (clash) {
    return NextResponse.json(
      { error: `A problem with slug "${d.slug}" already exists. Edit it instead, or change the title.` },
      { status: 409 }
    );
  }

  const problem = await prisma.problem.create({
    data: {
      slug: d.slug,
      title: d.title,
      difficulty: d.difficulty,
      description: d.description,
      functionName: d.functionName,
      patternHint: d.patternHint,
      starterCode: d.starterCode,
      topics: { connect: d.topics.map((slug) => ({ slug })) },
      testCases: { create: d.cases },
    },
  });
  return NextResponse.json({ problem: { id: problem.id, slug: problem.slug } });
}
