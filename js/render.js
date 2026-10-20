// Markdown + math rendering. Lesson text is markdown with $...$ inline math
// and $$...$$ display math. Math is pulled out before markdown parsing (so
// underscores and backslashes survive), the HTML is sanitized, then KaTeX
// output is swapped back in.

/* global katex, marked, DOMPurify */

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export { esc };

export function tex(latex, displayMode = false) {
  try {
    return katex.renderToString(latex, { displayMode, throwOnError: false, strict: "ignore", output: "htmlAndMathml" });
  } catch {
    return `<code>${esc(latex)}</code>`;
  }
}

const token = (kind, i) => `KX${kind}${i}XK`;

export function md(src, { inline = false } = {}) {
  if (!src) return "";
  let text = String(src);
  const code = [];
  const math = [];

  // 1. Protect code so "$" inside code isn't treated as math.
  text = text.replace(/```[\s\S]*?```|`[^`\n]+`/g, (m) => {
    code.push(m);
    return token("C", code.length - 1);
  });
  // 2. Escaped dollars are literal money signs.
  text = text.replace(/\\\$/g, "KXDOLLARXK");
  // 3. Display math, then inline math (no space just inside the delimiters,
  //    so "$5 and $10" stays text).
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => {
    math.push(tex(m.trim(), true));
    return token("D", math.length - 1);
  });
  text = text.replace(/\$(?=\S)([^$\n]+?)(?<=\S)\$(?!\d)/g, (_, m) => {
    math.push(tex(m, false));
    return token("I", math.length - 1);
  });
  // 4. Restore code, render markdown, sanitize.
  text = text.replace(/KXC(\d+)XK/g, (_, i) => code[i]);
  let html = inline ? marked.parseInline(text) : marked.parse(text);
  html = DOMPurify.sanitize(html, { ADD_ATTR: ["target"] });
  // 5. Swap math and dollar signs back in.
  html = html
    .replace(/<p>\s*KXD(\d+)XK\s*<\/p>/g, (_, i) => `<div class="math-display">${math[i]}</div>`)
    .replace(/KX[DI](\d+)XK/g, (_, i) => math[i])
    .replace(/KXDOLLARXK/g, "$");
  return html;
}

export const mdInline = (src) => md(src, { inline: true });

// Mermaid is large, so it's only fetched the first time a lesson has a diagram.
let mermaidPromise;
function loadMermaid() {
  mermaidPromise ??= import("https://cdn.jsdelivr.net/npm/mermaid@11.9.0/dist/mermaid.esm.min.mjs").then((m) => {
    const dark = document.documentElement.dataset.resolvedTheme === "dark";
    m.default.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      // SVG text labels keep the site's CSS from skewing Mermaid's measurements.
      htmlLabels: false,
      flowchart: { htmlLabels: false, useMaxWidth: true },
      theme: "base",
      fontFamily: "Plus Jakarta Sans, system-ui, sans-serif",
      themeVariables: dark
        ? { primaryColor: "#262a36", primaryTextColor: "#f1f0ec", primaryBorderColor: "#ff7652", lineColor: "#9aa0ae", background: "#181a21" }
        : { primaryColor: "#fff4ef", primaryTextColor: "#17181c", primaryBorderColor: "#ff5a36", lineColor: "#7c8190", background: "#ffffff" },
    });
    return m.default;
  });
  return mermaidPromise;
}

let diagramId = 0;
export async function renderDiagrams(root) {
  const nodes = root.querySelectorAll("[data-mermaid]:not([data-rendered])");
  if (!nodes.length) return;
  let mermaid;
  try {
    mermaid = await loadMermaid();
  } catch {
    nodes.forEach((n) => n.closest(".block-diagram")?.classList.add("diagram-failed"));
    return;
  }
  for (const node of nodes) {
    node.dataset.rendered = "1";
    try {
      const { svg } = await mermaid.render(`mmd-${++diagramId}`, node.dataset.mermaid);
      node.innerHTML = svg;
      node.classList.add("in");
    } catch {
      // A diagram with a syntax error is dropped quietly; the lesson text still stands.
      node.closest(".block-diagram")?.classList.add("diagram-failed");
    }
  }
}
