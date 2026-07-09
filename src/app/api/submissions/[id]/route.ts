import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { TestRunResult, VisualizationPayload } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const submission = await prisma.submission.findUnique({
    where: { id: params.id },
    include: { problem: { select: { id: true, slug: true, title: true, functionName: true } } },
  });
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    submission: {
      id: submission.id,
      status: submission.status,
      language: submission.language,
      sourceCode: submission.sourceCode,
      createdAt: submission.createdAt,
      problem: submission.problem,
      results: JSON.parse(submission.resultsJson) as TestRunResult[],
      visualization: submission.pipelineJson
        ? (JSON.parse(submission.pipelineJson) as VisualizationPayload)
        : null,
    },
  });
}
