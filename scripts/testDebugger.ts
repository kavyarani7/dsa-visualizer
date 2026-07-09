import { instrumentForDebugger } from "../src/lib/pipeline/genericInstrument";
import { runDebugger } from "../src/lib/pipeline/debuggerRunner";

const twoSum = `function twoSum(numbers, target) {
  let left = 0, right = numbers.length - 1;
  while (left < right) {
    const sum = numbers[left] + numbers[right];
    if (sum === target) return [left + 1, right + 1];
    if (sum < target) left++; else right--;
  }
  return [];
}`;

// recursion + shared heap references
const listSum = `function listSum(node) {
  if (node === null) return 0;
  return node.val + listSum(node.next);
}`;

async function run(name: string, src: string, fn: string, args: unknown[]) {
  console.log("\n=== " + name + " ===");
  const inst = instrumentForDebugger(src);
  console.log("instrumented ok:", inst.ok);
  const res = await runDebugger(src, fn, args);
  console.log("steps:", res.steps.length, "programError:", res.programError, "sandboxError:", res.sandboxError);
  const show = (i: number) => {
    const s = res.steps[i];
    if (!s) return;
    console.log(`  step ${s.step} @line ${s.lineNo} | stack depth ${s.stack.length}`);
    const top = s.stack[s.stack.length - 1];
    console.log(`    ${top.fn} locals:`, top.locals.map((l) => `${l.name}=${JSON.stringify(l.value)}`).join(", "));
    if (s.heap.length) console.log(`    heap:`, JSON.stringify(s.heap));
  };
  show(0);
  show(Math.floor(res.steps.length / 2));
  show(res.steps.length - 1);
}

async function main() {
  await run("Two Sum (loop + array on heap)", twoSum, "twoSum", [[2, 7, 11, 15], 9]);
  await run("List Sum (recursion + linked nodes)", listSum, "listSum", [
    { val: 1, next: { val: 2, next: { val: 3, next: null } } },
  ]);
}

main().catch((e) => { console.error(e); process.exit(1); });
