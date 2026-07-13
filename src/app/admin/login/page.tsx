import Link from "next/link";
import { redirect } from "next/navigation";
import { adminConfigured, isAdmin } from "@/lib/admin/auth";
import LoginForm from "@/components/admin/LoginForm";

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  if (isAdmin()) redirect("/admin");

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-10">
      <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Back to site
      </Link>
      <h1 className="text-xl font-semibold mt-4 mb-4">Admin sign in</h1>
      {adminConfigured() ? (
        <LoginForm />
      ) : (
        <div className="text-sm text-zinc-300 bg-zinc-800/40 border border-zinc-700 rounded-md p-4 max-w-lg">
          The admin area is disabled because <code className="text-emerald-300">ADMIN_PASSWORD</code> is not
          set. Add it to your environment (locally in <code className="text-emerald-300">.env</code>, and in
          your host&apos;s environment variables) and restart to enable it.
        </div>
      )}
    </div>
  );
}
