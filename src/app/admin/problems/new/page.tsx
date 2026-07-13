import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin/auth";
import ProblemForm from "@/components/admin/ProblemForm";

export const dynamic = "force-dynamic";

export default async function NewProblemPage() {
  if (!isAdmin()) redirect("/admin/login");
  const topics = await prisma.topic.findMany({ orderBy: { ordinal: "asc" }, select: { slug: true, name: true } });

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-8">
      <Link href="/admin" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Admin
      </Link>
      <h1 className="text-xl font-semibold mt-4 mb-5">New problem</h1>
      <ProblemForm topics={topics} />
    </div>
  );
}
