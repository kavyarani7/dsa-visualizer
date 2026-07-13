"use client";

import Editor, { type Monaco } from "@monaco-editor/react";

// Comfortable neutral editor theme in the familiar VS Code "Dark+" family (what
// LeetCode's editor resembles): a soft #1e1e1e background rather than a harsh
// near-black, with easy-on-the-eyes syntax colors.
function defineHighContrastTheme(monaco: Monaco) {
  monaco.editor.defineTheme("dsa-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6a9955", fontStyle: "italic" },
      { token: "keyword", foreground: "569cd6" },
      { token: "keyword.js", foreground: "569cd6" },
      { token: "string", foreground: "ce9178" },
      { token: "number", foreground: "b5cea8" },
      { token: "type", foreground: "4ec9b0" },
      { token: "delimiter", foreground: "d4d4d4" },
      { token: "identifier", foreground: "d4d4d4" },
    ],
    colors: {
      "editor.background": "#1e1e1e",
      "editor.foreground": "#d4d4d4",
      "editorLineNumber.foreground": "#858585",
      "editorLineNumber.activeForeground": "#c6c6c6",
      "editorCursor.foreground": "#34d399",
      "editor.selectionBackground": "#264f78",
      "editor.lineHighlightBackground": "#2a2d2e",
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
    <div className="rounded-lg overflow-hidden border border-zinc-800 w-full h-full min-h-[380px]">
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
        loading={<div className="p-4 text-sm text-zinc-400">Loading editor…</div>}
      />
    </div>
  );
}
