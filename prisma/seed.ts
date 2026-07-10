import { PrismaClient } from "@prisma/client";

// Seed over the direct connection when available (the pooled/transaction URL is
// meant for the serverless app runtime, not bulk DDL/writes).
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});

interface SeedCase {
  input: unknown[];
  expected: unknown;
  isSample?: boolean;
}

interface SeedProblem {
  slug: string;
  title: string;
  difficulty: string;
  functionName: string;
  patternHint: string;
  description: string;
  starterCode: string;
  cases: SeedCase[];
}

const problems: SeedProblem[] = [
  {
    slug: "two-sum-ii",
    title: "Two Sum II - Input Array Is Sorted",
    difficulty: "Medium",
    functionName: "twoSum",
    patternHint: "two_pointer",
    description: `Given a **1-indexed** array of integers \`numbers\` that is already sorted in non-decreasing order, find two numbers such that they add up to a specific \`target\`.

Return the indices of the two numbers, \`[index1, index2]\`, **1-indexed**, with \`index1 < index2\`.

There is exactly one solution. You may not use the same element twice.

**Example**
\`\`\`
Input: numbers = [2,7,11,15], target = 9
Output: [1,2]
\`\`\``,
    starterCode: `function twoSum(numbers, target) {
  // Two pointers from both ends of the sorted array.
  let left = 0, right = numbers.length - 1;
  while (left < right) {
    const sum = numbers[left] + numbers[right];
    if (sum === target) return [left + 1, right + 1];
    if (sum < target) left++;
    else right--;
  }
  return [];
}`,
    cases: [
      { input: [[2, 7, 11, 15], 9], expected: [1, 2], isSample: true },
      { input: [[2, 3, 4], 6], expected: [1, 3], isSample: true },
      { input: [[-1, 0], -1], expected: [1, 2] },
      { input: [[5, 25, 75], 100], expected: [2, 3] },
      { input: [[1, 2, 3, 4, 4, 9, 56, 90], 8], expected: [4, 5] },
    ],
  },
  {
    slug: "valid-palindrome",
    title: "Valid Palindrome",
    difficulty: "Easy",
    functionName: "isPalindrome",
    patternHint: "two_pointer",
    description: `A phrase is a **palindrome** if, after converting all uppercase letters into lowercase and removing all non-alphanumeric characters, it reads the same forward and backward.

Given a string \`s\`, return \`true\` if it is a palindrome, or \`false\` otherwise.

**Example**
\`\`\`
Input: s = "A man, a plan, a canal: Panama"
Output: true
\`\`\``,
    starterCode: `function isPalindrome(s) {
  const clean = s.toLowerCase().replace(/[^a-z0-9]/g, "");
  let left = 0, right = clean.length - 1;
  while (left < right) {
    if (clean[left] !== clean[right]) return false;
    left++;
    right--;
  }
  return true;
}`,
    cases: [
      { input: ["A man, a plan, a canal: Panama"], expected: true, isSample: true },
      { input: ["race a car"], expected: false, isSample: true },
      { input: [" "], expected: true },
      { input: ["0P"], expected: false },
      { input: ["ab_a"], expected: true },
    ],
  },
  {
    slug: "container-with-most-water",
    title: "Container With Most Water",
    difficulty: "Medium",
    functionName: "maxArea",
    patternHint: "two_pointer",
    description: `You are given an integer array \`height\` of length \`n\`. There are \`n\` vertical lines such that the two endpoints of the \`i\`-th line are \`(i, 0)\` and \`(i, height[i])\`.

Find two lines that, together with the x-axis, form a container that holds the most water. Return the maximum amount of water a container can store.

**Example**
\`\`\`
Input: height = [1,8,6,2,5,4,8,3,7]
Output: 49
\`\`\``,
    starterCode: `function maxArea(height) {
  let left = 0, right = height.length - 1;
  let best = 0;
  while (left < right) {
    const area = Math.min(height[left], height[right]) * (right - left);
    best = Math.max(best, area);
    if (height[left] < height[right]) left++;
    else right--;
  }
  return best;
}`,
    cases: [
      { input: [[1, 8, 6, 2, 5, 4, 8, 3, 7]], expected: 49, isSample: true },
      { input: [[1, 1]], expected: 1, isSample: true },
      { input: [[4, 3, 2, 1, 4]], expected: 16 },
      { input: [[1, 2, 1]], expected: 2 },
      { input: [[2, 3, 4, 5, 18, 17, 6]], expected: 17 },
    ],
  },
  {
    slug: "number-of-islands",
    title: "Number of Islands",
    difficulty: "Medium",
    functionName: "numIslands",
    patternHint: "bfs",
    description: `Given an \`m x n\` 2D binary grid \`grid\` which represents a map of \`"1"\`s (land) and \`"0"\`s (water), return the number of islands.

An island is surrounded by water and is formed by connecting adjacent lands horizontally or vertically.

**Example**
\`\`\`
Input: grid = [
  ["1","1","0","0","0"],
  ["1","1","0","0","0"],
  ["0","0","1","0","0"],
  ["0","0","0","1","1"]
]
Output: 3
\`\`\``,
    starterCode: `function numIslands(grid) {
  const rows = grid.length, cols = grid[0].length;
  const visited = new Set();
  let count = 0;
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
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols &&
                grid[nr][nc] === "1" && !visited.has(nr + "," + nc)) {
              visited.add(nr + "," + nc);
              queue.push([nr, nc]);
            }
          }
        }
      }
    }
  }
  return count;
}`,
    cases: [
      {
        input: [[
          ["1", "1", "0", "0", "0"],
          ["1", "1", "0", "0", "0"],
          ["0", "0", "1", "0", "0"],
          ["0", "0", "0", "1", "1"],
        ]],
        expected: 3,
        isSample: true,
      },
      {
        input: [[
          ["1", "1", "1"],
          ["0", "1", "0"],
          ["1", "1", "1"],
        ]],
        expected: 1,
        isSample: true,
      },
      { input: [[["0"]]], expected: 0 },
      {
        input: [[
          ["1", "0", "1"],
          ["0", "0", "0"],
          ["1", "0", "1"],
        ]],
        expected: 4,
      },
    ],
  },
  {
    slug: "rotting-oranges",
    title: "Rotting Oranges",
    difficulty: "Medium",
    functionName: "orangesRotting",
    patternHint: "bfs",
    description: `You are given an \`m x n\` grid where each cell can be: \`0\` (empty), \`1\` (fresh orange), or \`2\` (rotten orange).

Every minute, any fresh orange that is 4-directionally adjacent to a rotten orange becomes rotten. Return the minimum number of minutes until no cell has a fresh orange. If this is impossible, return \`-1\`.

**Example**
\`\`\`
Input: grid = [[2,1,1],[1,1,0],[0,1,1]]
Output: 4
\`\`\``,
    starterCode: `function orangesRotting(grid) {
  const rows = grid.length, cols = grid[0].length;
  const queue = [];
  let fresh = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 2) queue.push([r, c, 0]);
      else if (grid[r][c] === 1) fresh++;
    }
  }
  let minutes = 0;
  while (queue.length > 0) {
    const [r, c, t] = queue.shift();
    minutes = Math.max(minutes, t);
    for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] === 1) {
        grid[nr][nc] = 2;
        fresh--;
        queue.push([nr, nc, t + 1]);
      }
    }
  }
  return fresh === 0 ? minutes : -1;
}`,
    cases: [
      { input: [[[2, 1, 1], [1, 1, 0], [0, 1, 1]]], expected: 4, isSample: true },
      { input: [[[2, 1, 1], [0, 1, 1], [1, 0, 1]]], expected: -1, isSample: true },
      { input: [[[0, 2]]], expected: 0 },
      { input: [[[1]]], expected: -1 },
    ],
  },
];

async function main() {
  console.log("Seeding database…");
  // Idempotent: clear and re-seed.
  await prisma.submission.deleteMany();
  await prisma.testCase.deleteMany();
  await prisma.problem.deleteMany();

  for (const p of problems) {
    const created = await prisma.problem.create({
      data: {
        slug: p.slug,
        title: p.title,
        difficulty: p.difficulty,
        description: p.description,
        functionName: p.functionName,
        patternHint: p.patternHint,
        starterCode: p.starterCode,
      },
    });
    await prisma.testCase.createMany({
      data: p.cases.map((c, i) => ({
        problemId: created.id,
        inputJson: JSON.stringify(c.input),
        expectedJson: JSON.stringify(c.expected),
        isSample: c.isSample ?? false,
        ordinal: i,
      })),
    });
    console.log(`  ✓ ${p.title} (${p.cases.length} cases)`);
  }
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
