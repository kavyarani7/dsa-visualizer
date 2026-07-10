# Deploying (Vercel + Supabase Postgres)

The whole Next.js app (UI **and** backend/API) deploys to Vercel as one unit;
Supabase provides the Postgres database. All the code changes are already in the
repo — these are the steps only you can do (they need your logins).

> ⚠️ **Security note:** submitted JavaScript runs in Node's `vm` with a timeout,
> which is **not** a hardening boundary. This is fine for a demo, but treat the
> public URL as "runs untrusted code on my server." Don't put anything sensitive
> in the same project, and consider adding rate limiting before sharing widely.

## 1. Create the Supabase database

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. Open **Connect** (top bar) and copy two connection strings:
   - **Transaction pooler** (port `6543`) → this is `DATABASE_URL`.
     Append `?pgbouncer=true` to it.
   - **Session pooler** or **Direct connection** (port `5432`) → this is `DIRECT_URL`.
3. Replace `PASSWORD` in each with your database password.

## 2. Create the schema + seed the problems (run locally, once)

With `.env` filled in (see `.env.example`):

```bash
npm install
npx prisma db push     # creates the tables in Supabase (uses DIRECT_URL)
npm run db:seed        # inserts the 5 seed problems + test cases
```

Verify in Supabase → Table editor that `Problem` / `TestCase` are populated.

## 3. Deploy the app to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and **Import** the
   `dsa-visualizer` GitHub repo. Framework auto-detects as Next.js.
2. Under **Environment Variables**, add:
   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | the pooled `6543` string (with `?pgbouncer=true`) |
   | `DIRECT_URL` | the direct/session `5432` string |
   | `ANTHROPIC_API_KEY` | your key (optional — omit to run without LLM) |
   | `ANTHROPIC_MODEL` | `claude-haiku-4-5` |
3. **Deploy.** The build runs `prisma generate` (via `postinstall`) then
   `next build`.

That's it — Vercel gives you a `*.vercel.app` URL. Because the pages are
`force-dynamic`, they read from Supabase on each request (no build-time DB
needed).

## Notes

- **Local dev now uses Postgres too.** Point `.env` at your Supabase DB (or a
  local Postgres) and run `npm run dev`. The old SQLite `dev.db` is no longer
  used.
- **Function timeout:** `/api/submit` is set to `maxDuration = 60` so the
  judge + pipeline have room. Vercel Hobby allows up to 60s.
- **Redeploys:** every push to `master` auto-deploys. Schema changes need a
  `prisma db push` against Supabase (step 2) before the deploy that uses them.
