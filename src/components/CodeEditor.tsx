"use client";

import Editor, { type Monaco } from "@monaco-editor/react";

// High-contrast editor theme. Every token foreground is chosen to clear WCAG
// AAA (>=7:1) against the editor background (#0b1220), which itself blends with
// the surrounding slate panels. Verified with the in-app contrast audit.
function defineHighContrastTheme(monaco: Monaco) {
  monaco.editor.defineTheme("dsa-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "a7cf9f", fontStyle: "italic" }, // ~10:1
      { token: "keyword", foreground: "8ab4f8" }, // ~8.9:1
      { token: "keyword.js", foreground: "8ab4f8" },
      { token: "string", foreground: "e6b98a" }, // ~9:1
      { token: "number", foreground: "cbb2ff" }, // ~8:1
      { token: "type", foreground: "6fd3c7" }, // ~9:1
      { token: "delimiter", foreground: "cbd5e1" }, // slate-300, ~11:1
      { token: "identifier", foreground: "e2e8f0" }, // slate-200, ~13:1
    ],
    colors: {
      "editor.background": "#0b1220",
      "editor.foreground": "#e2e8f0",
      "editorLineNumber.foreground": "#94a3b8", // slate-400, ~7.3:1
      "editorLineNumber.activeForeground": "#e2e8f0",
      "editorCursor.foreground": "#34d399",
      "editor.selectionBackground": "#1e3a5f",
      "editor.lineHighlightBackground": "#0f1830",
      // Bracket-pair colorization palette, all chosen for AAA (>=7:1) on #0b1220.
      // (Monaco's defaults for #2 orchid / #3 blue only reach ~6.5:1.)
      "editorBracketHighlight.foreground1": "#ffd700", // ~13:1
      "editorBracketHighlight.foreground2": "#d8a7f0", // ~9.6:1
      "editorBracketHighlight.foreground3": "#8ab4f8", // ~8.9:1
      "editorBracketHighlight.foreground4": "#a7cf9f", // ~10:1
      "editorBracketHighlight.foreground5": "#e6b98a", // ~9:1
      "editorBracketHighlight.foreground6": "#6fd3c7", // ~9:1
      "editorBracketHighlight.unexpectedBracket.foreground": "#fda4af",
    },
  });
}

export default function CodeEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="rounded-lg overflow-hidden border border-slate-800 w-full h-full min-h-[380px]">
      <Editor
        height="100%"
        defaultLanguage="javascript"
        theme="dsa-dark"
        beforeMount={defineHighContrastTheme}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        options={{
          fontSize: 13,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          tabSize: 2,
          automaticLayout: true,
          padding: { top: 12, bottom: 12 },
          // Bracket-pair colorization uses mid-tone colors (~6.5:1). Disable it
          // so brackets inherit the high-contrast delimiter color (AAA).
          bracketPairColorization: { enabled: false },
        }}
        loading={<div className="p-4 text-sm text-slate-400">Loading editor…</div>}
      />
    </div>
  );
}
