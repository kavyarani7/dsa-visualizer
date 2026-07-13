"use client";

import type { TraceEvent, VisualActorConfig } from "@/lib/types";

function toCells(arr: unknown): string[] {
  if (typeof arr === "string") return arr.split("");
  if (Array.isArray(arr)) return arr.map((x) => (typeof x === "string" ? x : JSON.stringify(x)));
  return [];
}

export default function ArrayVisualizer({
  event,
  actorConfig,
}: {
  event: TraceEvent | null;
  actorConfig: VisualActorConfig;
}) {
  const actors = event?.actors ?? {};
  const cells = toCells(actors.arr);
  const left = typeof actors.left === "number" ? actors.left : -1;
  const right = typeof actors.right === "number" ? actors.right : -1;
  const leftStyle = actorConfig.roleMapping.left ?? "arrow";
  const rightStyle = actorConfig.roleMapping.right ?? "arrow";

  if (cells.length === 0) {
    return <div className="text-sm text-zinc-400">No array data for this step.</div>;
  }

  return (
    <div className="overflow-x-auto py-4">
      <div className="inline-flex gap-1.5 min-w-full">
        {cells.map((c, i) => {
          const isLeft = i === left;
          const isRight = i === right;
          const active = isLeft || isRight;
          return (
            <div key={i} className="flex flex-col items-center gap-1" style={{ minWidth: 40 }}>
              {/* pointer marker above */}
              <div className="h-6 flex items-end justify-center text-xs font-semibold">
                {isLeft && (
                  <span className="text-sky-400" title={`left = ${left} (${leftStyle})`}>
                    L↓
                  </span>
                )}
                {isRight && !isLeft && (
                  <span className="text-fuchsia-400" title={`right = ${right} (${rightStyle})`}>
                    R↓
                  </span>
                )}
                {isRight && isLeft && <span className="text-amber-400">LR↓</span>}
              </div>
              <div
                className={[
                  "w-10 h-10 flex items-center justify-center rounded-md border text-sm font-mono transition-colors",
                  active
                    ? isLeft && isRight
                      ? "bg-amber-500/20 border-amber-400 text-amber-200"
                      : isLeft
                        ? "bg-sky-500/20 border-sky-400 text-sky-200"
                        : "bg-fuchsia-500/20 border-fuchsia-400 text-fuchsia-200"
                    : "bg-zinc-800/60 border-zinc-700 text-zinc-300",
                ].join(" ")}
              >
                {c}
              </div>
              <div className="text-[10px] text-zinc-400 tabular-nums">{i}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
