import { extractFeatures, detect } from "../src/lib/pipeline/astAnalysis";
import { instrumentSource } from "../src/lib/pipeline/instrument";
import { runInstrumented } from "../src/lib/pipeline/traceRunner";

const twoSum = `
function twoSum(numbers, target) {
  let left = 0, right = numbers.length - 1;
  while (left < right) {
    const sum = numbers[left] + numbers[right];
    if (sum === target) return [left + 1, right + 1];
    if (sum < target) left++; else right--;
  }
  return [];
}`;

const islands = `
function numIslands(grid) {
  let count = 0;
  const rows = grid.length, cols = grid[0].length;
  const visited = new Set();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === "1" && !visited.has(r + "," + c)) {
        count++;
        const queue = [[r, c]];
        visited.add(r + "," + c);
        while (queue.length > 0) {
          const [cr, cc] = queue.shift();
          const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
          for (const [dr, dc] of dirs) {
            const nr = cr + dr, nc = cc + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] === "1" && !visited.has(nr + "," + nc)) {
              visited.add(nr + "," + nc);
              queue.push([nr, nc]);
            }
          }
        }
      }
    }
  }
  return count;
}`;

async function run(name: string, src: string, fn: string, args: unknown[]) {
  console.log("\n=== " + name + " ===");
  const f = extractFeatures(src);
  const d = detect(f);
  console.log("detected:", d.algorithm, "confidence:", d.confidence);
  console.log("vars:", { left: f.leftVar, right: f.rightVar, arr: f.arrayVar, queue: f.queueVar, visited: f.visitedVar });

  const plan =
    d.algorithm === "two_pointer"
      ? { kind: "two_pointer" as const, leftVar: f.leftVar, rightVar: f.rightVar, arrayVar: f.arrayVar }
      : { kind: "bfs" as const, queueVar: f.queueVar, visitedVar: f.visitedVar };

  const inst = instrumentSource(src, plan);
  console.log("injected:", inst.injected);

  const res = await runInstrumented(inst.code, fn, args);
  console.log("events:", res.events.length, "programError:", res.programError, "sandboxError:", res.sandboxError);
  console.log("first 4 events:", JSON.stringify(res.events.slice(0, 4)));
  console.log("last event:", JSON.stringify(res.events[res.events.length - 1]));
}

async function main() {
  await run("Two Sum II", twoSum, "twoSum", [[2, 7, 11, 15], 9]);
  await run("Number of Islands", islands, "numIslands", [
    [
      ["1", "1", "0", "0"],
      ["1", "0", "0", "1"],
      ["0", "0", "1", "1"],
    ],
  ]);
}

main().catch((e) => { console.error(e); process.exit(1); });
