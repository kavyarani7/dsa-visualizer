import { NextResponse } from "next/server";
import { visualizeInput } from "@/lib/submissionService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Runs ONLY the visualization pipeline on a chosen input — no judging, no
// persistence. Powers the "simulate this test case" selector so any user can
// watch the run on any sample or custom input.
export async function POST(req: Request) {
  let body: { problemId?: string; sourceCode?: string; input?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { problemId, sourceCode, input } = body;
  if (!problemId || typeof sourceCode !== "string") {
    return NextResponse.json({ error: "problemId and sourceCode are required" }, { status: 400 });
  }
  if (!Array.isArray(input)) {
    return NextResponse.json({ error: "input must be a JSON array of arguments" }, { status: 400 });
  }
  if (sourceCode.length > 20000) {
    return NextResponse.json({ error: "Source code too large" }, { status: 413 });
  }

  try {
    const visualization = await visualizeInput(problemId, sourceCode, input);
    return NextResponse.json({ visualization });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Visualization failed" },
      { status: 500 }
    );
  }
}
