import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin/auth";
import { parseProblemInput, type RawProblem } from "@/lib/admin/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const problem = await prisma.problem.findUnique({
    where: { id: params.id },
    include: { testCases: { orderBy: { ordinal: "asc" } }, topics: { select: { slug: true } } },
  });
  if (!problem) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ problem });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  if (!isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: RawProblem;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const existing = await prisma.problem.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = parseProblemInput(raw);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const d = parsed.data;

  // Slug uniqueness (allow keeping own slug).
  const clash = await prisma.problem.findUnique({ where: { slug: d.slug } });
  if (clash && clash.id !== params.id) {
    return NextResponse.json({ error: `Another problem already uses slug "${d.slug}".` }, { status: 409 });
  }

  // Replace test cases and reset topic links; submissions are untouched.
  await prisma.testCase.deleteMany({ where: { problemId: params.id } });
  const problem = await prisma.problem.update({
    where: { id: params.id },
    data: {
      slug: d.slug,
      title: d.title,
      difficulty: d.difficulty,
      description: d.description,
      functionName: d.functionName,
      patternHint: d.patternHint,
      starterCode: d.starterCode,
      topics: { set: d.topics.map((slug) => ({ slug })) },
      testCases: { create: d.cases },
    },
  });
  return NextResponse.json({ problem: { id: problem.id, slug: problem.slug } });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.problem.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
