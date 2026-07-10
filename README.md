# DSA Visualizer

A LeetCode-style DSA practice app with a twist: after you submit a correct
JavaScript solution, it **detects the technique you used** and renders an
**animated, step-by-step visualization of your actual run** — plus a
Python-Tutor-style **step-through debugger** for *any* program.

Two views for every passing submission:

- **Algorithm view** — for detected patterns (two-pointer, BFS), animates the
  key actors of your real execution (pointer arrows over an array; a queue /
  visited-set over a grid).
- **Step-through** — a generic debugger for arbitrary error-free JS: the current
  line, the call stack, and the heap with reference arrows (linked lists,
  aliased arrays, and recursion all render correctly).

## How it works

```
submit JS ─► judge (sandbox + test cases) ─► if all pass ─► analysis pipeline ─► visualization
```

- **Judge** ([src/lib/judge](src/lib/judge)) — runs submissions against seeded
  test cases in a timeout-bounded sandbox. Language-agnostic interface; only
  JavaScript is implemented today.
- **Analysis & tracing pipeline** ([src/lib/pipeline](src/lib/pipeline)) — a
  [LangGraph.js](https://github.com/langchain-ai/langgraphjs) `StateGraph`: it
  statically detects the algorithm (falling back to an LLM only when the
  heuristic is unsure), instruments the code, runs it, normalizes the trace, and
  narrates it. A retry cycle + `MemorySaver` checkpointer make a transient
  sandbox failure recoverable without redoing earlier work.
- **Renderer** ([src/components](src/components)) — consumes a normalized trace,
  so views are decoupled from how the trace was produced.

The LLM is optional: the two LLM nodes (classification fallback, narration)
degrade to deterministic behavior when no `ANTHROPIC_API_KEY` is set.

## Tech stack

Next.js (App Router) · TypeScript · Tailwind · Monaco editor ·
Prisma + Postgres (Supabase) · LangGraph.js · Babel (AST instrumentation)

## Local development

Requires a Postgres database (a free [Supabase](https://supabase.com) project
works for both local and prod — see [DEPLOY.md](DEPLOY.md)).

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL / DIRECT_URL (+ optional ANTHROPIC_API_KEY)
npx prisma db push        # create the tables
npm run db:seed           # insert the 5 seed problems
npm run dev               # http://localhost:3000
```

Handy scripts in [`scripts/`](scripts) exercise each layer headlessly
(`testJudge`, `testPipeline`, `testDebugger`, `testE2E`).

## Scope & caveats

This is an MVP built to prove the architecture, with deliberate boundaries:

- **JavaScript only.** The judge interface is designed so other languages are
  additive, but only JS is implemented.
- **Two animated patterns** (two-pointer, BFS). Anything else still gets the
  step-through debugger; there's just no bespoke algorithm animation.
- **The sandbox is not hardened.** Submitted JS runs in Node's built-in `vm`
  with a timeout — fine for local use, but `vm` is *not* a security boundary.
  Do not expose a public instance that runs untrusted code without adding real
  isolation (containers/gVisor) and rate limiting.
- **Postgres everywhere.** Local and prod both use Postgres (Supabase); there's
  no SQLite fallback anymore.

## Deploying

See [DEPLOY.md](DEPLOY.md) — the app deploys to Vercel (UI + API together) with a
Supabase Postgres database.
