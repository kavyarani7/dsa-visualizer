import { prisma } from "../src/lib/db";
import { runSubmission } from "../src/lib/submissionService";

async function main() {
  const problems = await prisma.problem.findMany({ orderBy: { createdAt: "asc" } });
  for (const p of problems) {
    // The seeded starterCode is a correct reference solution.
    const out = await runSubmission(p.id, p.starterCode, "submit");
    const v = out.visualization;
    console.log(
      `\n${p.title}\n  status=${out.status}` +
        (v
          ? `  → algo=${v.detectedAlgorithm} conf=${v.detectionConfidence} steps=${v.trace.length}` +
            (v.unsupportedReason ? ` unsupported="${v.unsupportedReason}"` : "")
          : "  (no visualization)")
    );
    if (v && v.trace.length) {
      console.log(`  first note: ${v.trace[0].note}`);
      console.log(`  last note:  ${v.trace[v.trace.length - 1].note}`);
    }
  }

  // Negative case: a wrong solution must NOT run the pipeline.
  const tp = problems.find((p) => p.slug === "two-sum-ii")!;
  const wrong = await runSubmission(tp.id, "function twoSum(a,b){ return [9,9]; }", "submit");
  console.log(
    `\n[wrong submission] status=${wrong.status} hasVisualization=${wrong.visualization !== undefined} (expect failed / false)`
  );

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
