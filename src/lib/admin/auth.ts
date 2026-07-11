import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

// Lightweight single-admin gate. `ADMIN_PASSWORD` is the only credential; when
// it is unset, the admin area is fully disabled (fail closed). On login we set
// an httpOnly cookie holding an HMAC of a constant keyed by the password — so
// the cookie can't be forged without the password and never contains it.

const COOKIE_NAME = "dsa_admin";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function adminPassword(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  return pw && pw.length > 0 ? pw : null;
}

export function adminConfigured(): boolean {
  return adminPassword() !== null;
}

function sessionToken(): string {
  return createHmac("sha256", adminPassword()!).update("dsa-admin-session-v1").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** True if the submitted password matches ADMIN_PASSWORD. */
export function verifyPassword(input: string): boolean {
  const pw = adminPassword();
  if (!pw || typeof input !== "string") return false;
  return safeEqual(input, pw);
}

/** The cookie to set on successful login (attach to a NextResponse). */
export function sessionCookie() {
  return {
    name: COOKIE_NAME,
    value: sessionToken(),
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    },
  };
}

export function clearCookie() {
  return { name: COOKIE_NAME, value: "", options: { path: "/", maxAge: 0 } };
}

/** Read the current request's cookie and check it against the expected token. */
export function isAdmin(): boolean {
  if (!adminConfigured()) return false;
  const cookie = cookies().get(COOKIE_NAME)?.value;
  if (!cookie) return false;
  return safeEqual(cookie, sessionToken());
}
