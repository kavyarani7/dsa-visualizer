"use client";

import type { TraceEvent } from "@/lib/types";

interface Coord {
  r: number;
  c: number;
}

function parseCoord(entry: unknown): Coord | null {
  if (Array.isArray(entry) && typeof entry[0] === "number" && typeof entry[1] === "number") {
    return { r: entry[0], c: entry[1] };
  }
  if (typeof entry === "string") {
    const parts = entry.split(",").map((x) => Number(x));
    if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      return { r: parts[0], c: parts[1] };
    }
  }
  return null;
}

function keyOf(c: Coord) {
  return `${c.r},${c.c}`;
}

function coordSet(list: unknown): Set<string> {
  const s = new Set<string>();
  if (Array.isArray(list)) {
    for (const e of list) {
      const c = parseCoord(e);
      if (c) s.add(keyOf(c));
    }
  }
  return s;
}

export default function GridVisualizer({
  event,
  sampleInput,
}: {
  event: TraceEvent | null;
  sampleInput?: unknown[];
}) {
  const grid = Array.isArray(sampleInput?.[0]) ? (sampleInput![0] as unknown[][]) : null;
  if (!grid || !Array.isArray(grid[0])) {
    return <div className="text-sm text-slate-400">No grid data to render.</div>;
  }

  const actors = event?.actors ?? {};
  const queued = coordSet(actors.queue);
  const visited = coordSet(actors.visited);
  const current = parseCoord(actors.current);
  const currentKey = current ? keyOf(current) : null;

  const cols = grid[0].length;

  return (
    <div className="py-4">
      <div
        className="inline-grid gap-1"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {grid.map((row, r) =>
          row.map((val, c) => {
            const k = `${r},${c}`;
            const isCurrent = k === currentKey;
            const isQueued = queued.has(k);
            const isVisited = visited.has(k);

            let cls = "bg-slate-800/50 border-slate-700 text-slate-400";
            if (isVisited) cls = "bg-emerald-500/20 border-emerald-500/40 text-emerald-200";
            if (isQueued) cls = "bg-sky-500/20 border-sky-400 text-sky-200";
            if (isCurrent) cls = "bg-amber-500/30 border-amber-400 text-amber-100 ring-2 ring-amber-400";

            return (
              <div
                key={k}
                className={`w-9 h-9 flex items-center justify-center rounded border text-xs font-mono transition-colors ${cls}`}
                title={`(${r},${c}) = ${JSON.stringify(val)}`}
              >
                {typeof val === "string" ? val : JSON.stringify(val)}
              </div>
            );
          })
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-400">
        <Legend cls="bg-amber-500/30 border-amber-400" label="current" />
        <Legend cls="bg-sky-500/20 border-sky-400" label="in queue" />
        <Legend cls="bg-emerald-500/20 border-emerald-500/40" label="visited" />
      </div>

      {/* Queue readout */}
      <div className="mt-3 text-xs text-slate-400">
        <span className="text-slate-400">queue: </span>
        <span className="font-mono">
          [{Array.isArray(actors.queue) ? (actors.queue as unknown[]).map((e) => JSON.stringify(e)).join(", ") : ""}]
        </span>
      </div>
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block w-3 h-3 rounded border ${cls}`} />
      {label}
    </span>
  );
}
