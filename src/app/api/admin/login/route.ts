import { NextResponse } from "next/server";
import { adminConfigured, verifyPassword, sessionCookie, clearCookie } from "@/lib/admin/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!adminConfigured()) {
    return NextResponse.json({ error: "Admin is not configured (ADMIN_PASSWORD unset)." }, { status: 503 });
  }
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!verifyPassword(body.password ?? "")) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  const c = sessionCookie();
  res.cookies.set(c.name, c.value, c.options);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  const c = clearCookie();
  res.cookies.set(c.name, c.value, c.options);
  return res;
}
