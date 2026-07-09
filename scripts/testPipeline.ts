import { runPipeline } from "../src/lib/pipeline/run";

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
          for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
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

const dp = `
function fib(n) {
  const dp = [0, 1];
  for (let i = 2; i <= n; i++) dp[i] = dp[i-1] + dp[i-2];
  return dp[n];
}`;

async function main() {
  const tp = await runPipeline({
    submissionId: "s1", problemId: "p1", sourceCode: twoSum, functionName: "twoSum",
    sampleInput: [[2, 7, 11, 15], 9],
  });
  console.log("\n[two-pointer] algo=%s conf=%s method=%s steps=%d unsupported=%s",
    tp.detectedAlgorithm, tp.detectionConfidence, tp.detectionMethod, tp.trace.length, tp.unsupportedReason);
  console.log("  explanation:", tp.explanation);
  console.log("  step0:", JSON.stringify(tp.trace[0]));

  const bfs = await runPipeline({
    submissionId: "s2", problemId: "p2", sourceCode: islands, functionName: "numIslands",
    sampleInput: [[["1","1","0"],["1","0","0"],["0","0","1"]]],
  });
  console.log("\n[bfs] algo=%s conf=%s method=%s steps=%d unsupported=%s",
    bfs.detectedAlgorithm, bfs.detectionConfidence, bfs.detectionMethod, bfs.trace.length, bfs.unsupportedReason);
  console.log("  explanation:", bfs.explanation);
  console.log("  step0:", JSON.stringify(bfs.trace[0]));

  const un = await runPipeline({
    submissionId: "s3", problemId: "p3", sourceCode: dp, functionName: "fib",
    sampleInput: [10],
  });
  console.log("\n[unknown] algo=%s conf=%s steps=%d unsupported=%s",
    un.detectedAlgorithm, un.detectionConfidence, un.trace.length, un.unsupportedReason);

  console.log("\n--- debuggerTrace present on all three ---");
  console.log("two-pointer:", tp.debuggerTrace?.steps.length, "steps");
  console.log("bfs:", bfs.debuggerTrace?.steps.length, "steps");
  console.log("unknown/dp:", un.debuggerTrace?.steps.length, "steps (note:", un.debuggerTrace?.note, ")");
}

main().catch((e) => { console.error(e); process.exit(1); });
