"use client";

// Tiny, dependency-free markdown renderer for trusted seed descriptions.
// Handles fenced code blocks, inline code, bold, and headings.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, (_m, c) => `<code>${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, (_m, c) => `<strong>${c}</strong>`);
}

function render(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${paragraph.map(inline).join(" ")}</p>`);
      paragraph = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      flushParagraph();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        code.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }
    if (line.trim() === "") {
      flushParagraph();
      i++;
      continue;
    }
    paragraph.push(line);
    i++;
  }
  flushParagraph();
  return out.join("\n");
}

export default function Markdown({ children }: { children: string }) {
  return <div className="prose-dsa text-sm" dangerouslySetInnerHTML={{ __html: render(children) }} />;
}
