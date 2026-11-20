# LaTeX and Mermaid

Render math and diagrams inside the markdown message part by extending the generated `markdown-text.tsx`.

## Contents

- [Starting point](#starting-point)
- [LaTeX with KaTeX](#latex-with-katex)
- [Custom math delimiters](#custom-math-delimiters)
- [Mermaid diagrams](#mermaid-diagrams)
- [Wiring Mermaid in](#wiring-mermaid-in)
- [Notes](#notes)

## Starting point

Both features build on the registry `markdown-text` component; add it first if the project does not already have it:

```bash
npx assistant-ui@latest add markdown-text
```

See [./markdown-text.md](./markdown-text.md) for the base `MarkdownText` setup. The sections below extend that generated `markdown-text.tsx`.

## LaTeX with KaTeX

Add a remark plugin to parse math and a rehype plugin to render it with KaTeX.

```bash
npm install remark-math rehype-katex katex
```

Import the KaTeX stylesheet once, at the app root (`app/layout.tsx`):

```ts
import "katex/dist/katex.min.css";
```

Pass `remarkMath` alongside `remarkGfm`, and `rehypeKatex` via `rehypePlugins`:

```tsx
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

const MarkdownTextImpl = () => {
  return (
    <MarkdownTextPrimitive
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      className="aui-md"
      components={defaultComponents}
    />
  );
};
```

This renders `$...$` inline math, `$$...$$` display math, and fenced code blocks tagged with the `math` language identifier.

## Custom math delimiters

Models sometimes emit non-standard delimiters such as `\(...\)`, `\[...\]`, or `[math]...[/math]`. The `preprocess` prop normalizes the raw string before parsing, and it runs before `useSmooth`, so partial delimiters accumulate in the buffer instead of being parsed mid-stream.

```tsx
<MarkdownTextPrimitive
  remarkPlugins={[remarkGfm, remarkMath]}
  rehypePlugins={[rehypeKatex]}
  preprocess={normalizeCustomMathTags}
  className="aui-md"
  components={defaultComponents}
/>;

function normalizeCustomMathTags(input: string): string {
  return input
    .replace(/\[math\]([\s\S]*?)\[\/math\]/g, (_, c) => `$$${c.trim()}$$`)
    .replace(/\\{1,2}\(([\s\S]*?)\\{1,2}\)/g, (_, c) => `$${c.trim()}$`)
    .replace(/\\{1,2}\[([\s\S]*?)\\{1,2}\]/g, (_, c) => `$$${c.trim()}$$`);
}
```

## Mermaid diagrams

Mermaid is wired through `componentsByLanguage`, which overrides the `SyntaxHighlighter` for a single fenced language (here `mermaid`).

```bash
npm install mermaid
```

Create `components/assistant-ui/mermaid-diagram.tsx`. The component receives `SyntaxHighlighterProps` (carrying `code`, `node`, `components`, and `language`) and uses `useAuiState` to detect when the code fence has finished streaming before rendering, so Mermaid never parses a partial diagram.

```tsx
"use client";
import { useAuiState } from "@assistant-ui/react";
import type { SyntaxHighlighterProps } from "@assistant-ui/react-markdown";
import mermaid from "mermaid";
import { type FC, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type MermaidDiagramProps = SyntaxHighlighterProps & {
  className?: string;
};

mermaid.initialize({ theme: "default", startOnLoad: false });

export const MermaidDiagram: FC<MermaidDiagramProps> = ({
  code,
  className,
  node: _node,
  components: _components,
  language: _language,
}) => {
  const ref = useRef<HTMLPreElement>(null);

  const isComplete = useAuiState((s) => {
    if (s.part.type !== "text") return false;
    const codeIndex = s.part.text.indexOf(code);
    if (codeIndex === -1) return false;
    const afterCode = s.part.text.substring(codeIndex + code.length);
    return /^```|^\n```/.test(afterCode);
  });

  useEffect(() => {
    if (!isComplete) return;
    (async () => {
      try {
        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const result = await mermaid.render(id, code);
        if (ref.current) {
          ref.current.innerHTML = result.svg;
          result.bindFunctions?.(ref.current);
        }
      } catch (e) {
        console.warn("Failed to render Mermaid diagram:", e);
      }
    })();
  }, [isComplete, code]);

  return (
    <pre ref={ref} className={cn("aui-mermaid-diagram", className)}>
      Drawing diagram...
    </pre>
  );
};

MermaidDiagram.displayName = "MermaidDiagram";
```

## Wiring Mermaid in

Map the `mermaid` language key to the component through `componentsByLanguage`. Every other language falls back to the default highlighter.

```tsx
import { MermaidDiagram } from "@/components/assistant-ui/mermaid-diagram";

<MarkdownTextPrimitive
  remarkPlugins={[remarkGfm]}
  className="aui-md"
  components={defaultComponents}
  componentsByLanguage={{
    mermaid: { SyntaxHighlighter: MermaidDiagram },
  }}
/>;
```

## Notes

- `useAuiState` reads the current message part; the selector assumes the diagram lives in a `text` part, which is the markdown case.
- `componentsByLanguage` composes with `remarkPlugins` and `rehypePlugins`, so a single `MarkdownTextPrimitive` can run KaTeX and Mermaid together.
- `mermaid.initialize(...)` at module scope runs once per bundle; `startOnLoad: false` keeps Mermaid from scanning the DOM on its own.
