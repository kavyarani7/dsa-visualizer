import { getLlm, llmAvailable, llmClassify, llmExplain } from "../src/lib/pipeline/llm";

async function main() {
  console.log("llmAvailable:", llmAvailable(), "| model:", process.env.ANTHROPIC_MODEL);
  if (!llmAvailable()) {
    console.log("No API key — nothing to verify.");
    return;
  }

  // 1. A trivial raw call (this is the exact temperature:0 config that would 400 on Sonnet 5).
  const raw = await getLlm()!.invoke([{ role: "user", content: "Reply with the single word: ok" }]);
  console.log("raw call ok:", typeof raw.content === "string" ? raw.content : JSON.stringify(raw.content));

  // 2. The two pipeline nodes.
  const cls = await llmClassify(
    "function f(a){let l=0,r=a.length-1;while(l<r){if(a[l]+a[r]===0)return true;l++;}return false;}",
    { leftVar: "l", rightVar: "r" }
  );
  console.log("classify:", cls);

  const exp = await llmExplain("two_pointer", JSON.stringify([
    { step: 0, event: "move_pointer", actors: { left: 0, right: 3 } },
    { step: 1, event: "move_pointer", actors: { left: 0, right: 1 } },
  ]));
  console.log("explain:", exp);
}

main().catch((e) => { console.error("ERROR:", e?.message ?? e); process.exit(1); });
