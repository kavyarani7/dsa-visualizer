import { getJudge } from "../src/lib/judge";
import { activeEngine } from "../src/lib/judge/sandbox";

async function main() {
  console.log("sandbox engine:", activeEngine());
  const judge = getJudge("javascript");

  const twoSumSrc = `
function twoSum(numbers, target) {
  let left = 0, right = numbers.length - 1;
  while (left < right) {
    const sum = numbers[left] + numbers[right];
    if (sum === target) return [left + 1, right + 1];
    if (sum < target) left++; else right--;
  }
  return [];
}`;

  const out = await judge.run({
    sourceCode: twoSumSrc,
    functionName: "twoSum",
    testCases: [
      { ordinal: 0, isSample: true, input: [[2, 7, 11, 15], 9], expected: [1, 2] },
      { ordinal: 1, isSample: true, input: [[2, 3, 4], 6], expected: [1, 3] },
      { ordinal: 2, isSample: false, input: [[-1, 0], -1], expected: [1, 2] },
    ],
  });
  console.log("allPassed:", out.allPassed, "infra:", out.hadInfraError);
  for (const r of out.results) console.log(`  case ${r.ordinal}: passed=${r.passed} actual=${JSON.stringify(r.actual)} err=${r.error}`);

  // Wrong answer + timeout cases
  const bad = await judge.run({
    sourceCode: `function f(){ return 1; }`,
    functionName: "f",
    testCases: [{ ordinal: 0, isSample: true, input: [], expected: 2 }],
  });
  console.log("wrong-answer passed:", bad.results[0].passed, "(expect false)");

  const loop = await judge.run({
    sourceCode: `function f(){ while(true){} }`,
    functionName: "f",
    testCases: [{ ordinal: 0, isSample: true, input: [], expected: 1 }],
    timeoutMs: 500,
  });
  console.log("infinite-loop infraError:", loop.hadInfraError, "err:", loop.results[0].error);
}

main().catch((e) => { console.error(e); process.exit(1); });
