import { NextResponse } from "next/server";
import { runSubmission, type RunMode } from "@/lib/submissionService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { problemId?: string; sourceCode?: string; mode?: RunMode };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { problemId, sourceCode } = body;
  const mode: RunMode = body.mode === "submit" ? "submit" : "run";

  if (!problemId || typeof sourceCode !== "string") {
    return NextResponse.json({ error: "problemId and sourceCode are required" }, { status: 400 });
  }
  if (sourceCode.length > 20000) {
    return NextResponse.json({ error: "Source code too large" }, { status: 413 });
  }

  try {
    const result = await runSubmission(problemId, sourceCode, mode);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Submission failed" },
      { status: 500 }
    );
  }
}
