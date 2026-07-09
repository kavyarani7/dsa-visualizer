import type { SupportedLanguage } from "@/lib/types";
import type { Judge } from "./types";
import { JavascriptJudge } from "./javascriptJudge";

// Language -> judge registry. Add a language by implementing Judge and
// registering it here; callers use getJudge(language) and never branch.
const registry: Partial<Record<SupportedLanguage, Judge>> = {
  javascript: new JavascriptJudge(),
};

export function getJudge(language: SupportedLanguage): Judge {
  const judge = registry[language];
  if (!judge) throw new Error(`No judge registered for language: ${language}`);
  return judge;
}

export * from "./types";
