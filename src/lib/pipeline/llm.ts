import { ChatAnthropic } from "@langchain/anthropic";
import type { DetectedAlgorithm } from "@/lib/types";

// The LLM is strictly optional. Every function here returns null when no API key
// is configured (or on any error), and every caller has a deterministic
// fallback — so the pipeline runs end to end with or without a key.

let cached: ChatAnthropic | null | undefined;

export function getLlm(): ChatAnthropic | null {
  if (cached !== undefined) return cached;
  if (!process.env.ANTHROPIC_API_KEY) {
    cached = null;
    return cached;
  }
  cached = new ChatAnthropic({
    // Haiku 4.5 is plenty for the two lightweight LLM nodes (3-label
    // classification + short narration) and is ~3x cheaper than Sonnet. It also
    // accepts `temperature` — the Sonnet 5 / Opus 4.7+ family rejects non-default
    // sampling params with a 400, so don't default to those here.
    model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5",
    temperature: 0,
    maxTokens: 1024,
  });
  return cached;
}

export function llmAvailable(): boolean {
  return getLlm() !== null;
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => (typeof c === "string" ? c : typeof (c as { text?: string }).text === "string" ? (c as { text: string }).text : ""))
      .join("");
  }
  return "";
}

const SUPPORTED: DetectedAlgorithm[] = ["two_pointer", "bfs", "unknown"];

export async function llmClassify(
  sourceCode: string,
  astFeatures: Record<string, unknown>
): Promise<{ label: DetectedAlgorithm; confidence: number } | null> {
  const llm = getLlm();
  if (!llm) return null;
  try {
    const res = await llm.invoke([
      {
        role: "system",
        content:
          "You classify a JavaScript solution by its core algorithmic technique. " +
          'Respond with ONLY compact JSON: {"label": "two_pointer" | "bfs" | "unknown", "confidence": 0..1}. ' +
          "Use \"two_pointer\" for converging/diverging index pointers over an array/string. " +
          "Use \"bfs\" for breadth-first search using a queue and a visited set. " +
          "Use \"unknown\" for anything else (DFS, DP, Dijkstra, brute force, etc.).",
      },
      {
        role: "user",
        content: `AST features:\n${JSON.stringify(astFeatures)}\n\nCode:\n\`\`\`js\n${sourceCode}\n\`\`\``,
      },
    ]);
    const text = textOf(res.content);
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { label?: string; confidence?: number };
    const label = (parsed.label ?? "unknown") as DetectedAlgorithm;
    if (!SUPPORTED.includes(label)) return { label: "unknown", confidence: 0.5 };
    const confidence = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.6;
    return { label, confidence };
  } catch {
    return null;
  }
}

export async function llmExplain(
  algorithm: DetectedAlgorithm,
  compactTrace: string
): Promise<string[] | null> {
  const llm = getLlm();
  if (!llm) return null;
  try {
    const res = await llm.invoke([
      {
        role: "system",
        content:
          "You narrate an algorithm run for a learner. Given the technique and a compact trace, " +
          "produce 3-6 short bullet points describing what happens across the run, in order. " +
          "Return one bullet per line, no numbering, no markdown bullets, just plain sentences.",
      },
      {
        role: "user",
        content: `Technique: ${algorithm}\nTrace (JSON, possibly downsampled):\n${compactTrace}`,
      },
    ]);
    const text = textOf(res.content);
    const lines = text
      .split("\n")
      .map((l) => l.replace(/^[\s\-*\d.]+/, "").trim())
      .filter((l) => l.length > 0);
    return lines.length ? lines.slice(0, 6) : null;
  } catch {
    return null;
  }
}
