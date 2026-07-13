import { PrismaClient } from "@prisma/client";

// Usage: npx tsx scripts/deleteProblem.ts <slug>
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: npx tsx scripts/deleteProblem.ts <slug>");
    process.exit(1);
  }
  const p = await prisma.problem.findUnique({ where: { slug } });
  if (!p) {
    console.log(`No problem with slug "${slug}".`);
    return;
  }
  await prisma.problem.delete({ where: { slug } });
  console.log(`Deleted "${p.title}" (${slug}) — test cases, submissions, and topic links cascade.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
