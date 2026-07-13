import { NextResponse } from "next/server";
import { runSubmission, type RunMode, type CustomCase } from "@/lib/submissionService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The judge + LangGraph pipeline (+ optional LLM calls) can take several
// seconds; give the serverless function headroom beyond the 10s default.
export const maxDuration = 60;

interface RawCustomCase {
  inputJson?: string;
  expectedJson?: string;
}

/** Parse & validate the user-supplied custom cases (JSON strings from the UI). */
function parseCustomCases(raw: unknown): CustomCase[] | { error: string } {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return { error: "customCases must be an array" };
  if (raw.length > 20) return { error: "Too many custom test cases (max 20)" };

  const out: CustomCase[] = [];
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i] as RawCustomCase;
    let input: unknown;
    let expected: unknown;
    try {
      input = JSON.parse(c.inputJson ?? "");
    } catch {
      return { error: `Custom case ${i + 1}: input is not valid JSON.` };
    }
    if (!Array.isArray(input)) {
      return { error: `Custom case ${i + 1}: input must be a JSON array of arguments, e.g. [[2,7,11,15], 9].` };
    }
    try {
      expected = JSON.parse(c.expectedJson ?? "");
    } catch {
      return { error: `Custom case ${i + 1}: expected is not valid JSON.` };
    }
    out.push({ input, expected });
  }
  return out;
}

export async function POST(req: Request) {
  let body: { problemId?: string; sourceCode?: string; mode?: RunMode; customCases?: unknown };
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

  const parsedCustom = parseCustomCases(body.customCases);
  if (!Array.isArray(parsedCustom)) {
    return NextResponse.json({ error: parsedCustom.error }, { status: 400 });
  }

  try {
    const result = await runSubmission(problemId, sourceCode, mode, parsedCustom);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Submission failed" },
      { status: 500 }
    );
  }
}
