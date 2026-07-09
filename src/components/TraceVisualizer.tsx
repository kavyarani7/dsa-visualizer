"use client";

import { useEffect, useRef, useState } from "react";
import type { VisualizationPayload } from "@/lib/types";
import ArrayVisualizer from "./ArrayVisualizer";
import GridVisualizer from "./GridVisualizer";
import PlaybackControls from "./PlaybackControls";

const algoLabel: Record<string, string> = {
  two_pointer: "Two Pointers",
  bfs: "Breadth-First Search",
  unknown: "Unknown",
};

export default function TraceVisualizer({ visualization }: { visualization: VisualizationPayload }) {
  const { trace, detectedAlgorithm, detectionConfidence, detectionMethod, explanation } = visualization;
  const total = trace.length;

  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(800);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset playback whenever a new visualization arrives.
  useEffect(() => {
    setStep(0);
    setPlaying(total > 1);
  }, [visualization, total]);

  useEffect(() => {
    if (!playing) return;
    if (step >= total - 1) {
      setPlaying(false);
      return;
    }
    timer.current = setTimeout(() => setStep((s) => Math.min(s + 1, total - 1)), speed);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, step, speed, total]);

  const canAnimate = !visualization.unsupportedReason && total > 0;
  const current = canAnimate ? trace[Math.min(step, total - 1)] : null;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Visualization</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full border border-slate-700 bg-slate-800 text-slate-300">
            {algoLabel[detectedAlgorithm] ?? detectedAlgorithm}
          </span>
          {detectedAlgorithm !== "unknown" && (
            <span className="text-[11px] text-slate-400">
              detected via {detectionMethod || "static"} · {(detectionConfidence * 100).toFixed(0)}%
            </span>
          )}
        </div>
      </div>

      {!canAnimate ? (
        <div className="text-sm text-slate-400 bg-slate-800/40 rounded-md p-4">
          {visualization.unsupportedReason ??
            "No animation available for this submission."}
          <div className="text-xs text-slate-400 mt-1">
            Test results above are still valid — only the step-by-step animation is unavailable.
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-md bg-slate-950/40 border border-slate-800/60 px-3">
            {detectedAlgorithm === "two_pointer" ? (
              <ArrayVisualizer event={current} actorConfig={visualization.actorConfig} />
            ) : (
              <GridVisualizer event={current} sampleInput={visualization.sampleInput} />
            )}
          </div>

          <div className="mt-2 min-h-[20px] text-xs text-emerald-300 font-mono">
            {current?.note}
          </div>

          <div className="mt-3">
            <PlaybackControls
              step={step}
              total={total}
              playing={playing}
              speed={speed}
              onPlayPause={() => setPlaying((p) => !p)}
              onStep={(d) => {
                setPlaying(false);
                setStep((s) => Math.max(0, Math.min(total - 1, s + d)));
              }}
              onSeek={(s) => {
                setPlaying(false);
                setStep(s);
              }}
              onReset={() => {
                setPlaying(false);
                setStep(0);
              }}
              onSpeed={setSpeed}
            />
          </div>
        </>
      )}

      {explanation.length > 0 && (
        <div className="mt-4 border-t border-slate-800 pt-3">
          <div className="text-xs font-semibold text-slate-400 mb-1">How it works</div>
          <ul className="list-disc list-inside space-y-1 text-xs text-slate-300">
            {explanation.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
