export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export interface RawCase {
  inputJson?: string;
  expectedJson?: string;
  isSample?: boolean;
}

export interface RawProblem {
  title?: string;
  slug?: string;
  difficulty?: string;
  description?: string;
  functionName?: string;
  patternHint?: string;
  starterCode?: string;
  topics?: string[]; // topic slugs
  cases?: RawCase[];
}

export interface NormalizedProblem {
  slug: string;
  title: string;
  difficulty: string;
  description: string;
  functionName: string;
  patternHint: string;
  starterCode: string;
  topics: string[];
  cases: { inputJson: string; expectedJson: string; isSample: boolean; ordinal: number }[];
}

const DIFFICULTIES = ["Easy", "Medium", "Hard"];

/** Validate + normalize a problem submitted from the admin form. */
export function parseProblemInput(
  raw: RawProblem
): { ok: true; data: NormalizedProblem } | { ok: false; error: string } {
  const title = (raw.title ?? "").trim();
  if (!title) return { ok: false, error: "Title is required." };

  const slug = raw.slug?.trim() ? slugify(raw.slug) : slugify(title);
  if (!slug) return { ok: false, error: "Could not derive a slug from the title." };

  const difficulty = (raw.difficulty ?? "").trim();
  if (!DIFFICULTIES.includes(difficulty)) {
    return { ok: false, error: "Difficulty must be Easy, Medium, or Hard." };
  }

  const functionName = (raw.functionName ?? "").trim();
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(functionName)) {
    return { ok: false, error: "Function name must be a valid JS identifier." };
  }

  const starterCode = raw.starterCode ?? "";
  if (!starterCode.trim()) return { ok: false, error: "Starter code is required." };

  const rawCases = Array.isArray(raw.cases) ? raw.cases : [];
  if (rawCases.length === 0) return { ok: false, error: "Add at least one test case." };

  const cases: NormalizedProblem["cases"] = [];
  for (let i = 0; i < rawCases.length; i++) {
    const c = rawCases[i];
    let input: unknown;
    let expected: unknown;
    try {
      input = JSON.parse(c.inputJson ?? "");
    } catch {
      return { ok: false, error: `Test case ${i + 1}: "input" is not valid JSON.` };
    }
    if (!Array.isArray(input)) {
      return { ok: false, error: `Test case ${i + 1}: "input" must be a JSON array of arguments (e.g. [[2,7,11,15], 9]).` };
    }
    try {
      expected = JSON.parse(c.expectedJson ?? "");
    } catch {
      return { ok: false, error: `Test case ${i + 1}: "expected" is not valid JSON.` };
    }
    cases.push({
      inputJson: JSON.stringify(input),
      expectedJson: JSON.stringify(expected),
      isSample: c.isSample ?? true,
      ordinal: i,
    });
  }

  const topics = Array.isArray(raw.topics) ? raw.topics.filter((t) => typeof t === "string") : [];

  return {
    ok: true,
    data: {
      slug,
      title,
      difficulty,
      description: raw.description ?? "",
      functionName,
      patternHint: (raw.patternHint ?? "unknown").trim() || "unknown",
      starterCode,
      topics,
      cases,
    },
  };
}
