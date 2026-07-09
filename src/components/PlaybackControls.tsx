"use client";

export default function PlaybackControls({
  step,
  total,
  playing,
  speed,
  onPlayPause,
  onStep,
  onSeek,
  onReset,
  onSpeed,
}: {
  step: number;
  total: number;
  playing: boolean;
  speed: number;
  onPlayPause: () => void;
  onStep: (delta: number) => void;
  onSeek: (step: number) => void;
  onReset: () => void;
  onSpeed: (s: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={onReset}
          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs"
          title="Reset"
        >
          ⏮
        </button>
        <button
          onClick={() => onStep(-1)}
          disabled={step <= 0}
          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs disabled:opacity-40"
          title="Step back"
        >
          ◀
        </button>
        <button
          onClick={onPlayPause}
          className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-medium min-w-[64px]"
        >
          {playing ? "❚❚ Pause" : "▶ Play"}
        </button>
        <button
          onClick={() => onStep(1)}
          disabled={step >= total - 1}
          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs disabled:opacity-40"
          title="Step forward"
        >
          ▶
        </button>
        <span className="text-xs text-slate-400 ml-1 tabular-nums">
          step {total === 0 ? 0 : step + 1} / {total}
        </span>
        <div className="ml-auto flex items-center gap-1 text-xs text-slate-400">
          speed
          <select
            value={speed}
            onChange={(e) => onSpeed(Number(e.target.value))}
            className="bg-slate-800 rounded px-1 py-0.5 text-slate-200"
          >
            <option value={1600}>0.5×</option>
            <option value={800}>1×</option>
            <option value={400}>2×</option>
            <option value={200}>4×</option>
          </select>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(0, total - 1)}
        value={step}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="w-full accent-emerald-500"
      />
    </div>
  );
}
