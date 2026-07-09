import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const problems = await prisma.problem.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, slug: true, title: true, difficulty: true, patternHint: true },
  });
  return NextResponse.json({ problems });
}
