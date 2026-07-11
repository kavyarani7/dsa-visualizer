import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin/auth";
import { slugify } from "@/lib/admin/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string; blurb?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const slug = slugify(name);
  if (!slug) return NextResponse.json({ error: "Could not derive a slug" }, { status: 400 });

  const existing = await prisma.topic.findUnique({ where: { slug } });
  if (existing) return NextResponse.json({ error: `A topic "${slug}" already exists.` }, { status: 409 });

  const max = await prisma.topic.aggregate({ _max: { ordinal: true } });
  const topic = await prisma.topic.create({
    data: { slug, name, blurb: body.blurb?.trim() || null, ordinal: (max._max.ordinal ?? 0) + 1 },
  });
  return NextResponse.json({ topic });
}
