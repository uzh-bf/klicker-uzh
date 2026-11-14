---
name: markdown
description: "Render and customize assistant message text as markdown in assistant-ui. Use when displaying model output as formatted markdown with MarkdownTextPrimitive from @assistant-ui/react-markdown wired into the MessagePrimitive.Parts text branch, configuring remarkPlugins (remark-gfm, remark-math) and rehypePlugins (rehype-katex), or memoizing components with unstable_memoizeMarkdownComponents. Covers code-block syntax highlighting via react-shiki or react-syntax-highlighter registered as SyntaxHighlighter in components/componentsByLanguage, LaTeX math rendering with KaTeX, Mermaid diagrams gated on stream completion, custom math delimiters via preprocess, and the StreamdownTextPrimitive alternative from @assistant-ui/react-streamdown with built-in Shiki/KaTeX/Mermaid and block streaming. For general chat UI composition route to primitives."
license: MIT
---

# assistant-ui Markdown

**Always consult [assistant-ui.com/llms.txt](https://www.assistant-ui.com/llms.txt) for the latest API.**

Render and customize assistant message text as markdown with `MarkdownTextPrimitive` from `@assistant-ui/react-markdown`, wired into the `MessagePrimitive.Parts` text branch.

## References

- [./references/markdown-text.md](./references/markdown-text.md) -- MarkdownTextPrimitive setup
- [./references/syntax-highlighting.md](./references/syntax-highlighting.md) -- code highlighting (react-shiki / react-syntax-highlighter)
- [./references/latex-mermaid.md](./references/latex-mermaid.md) -- LaTeX and Mermaid
- [./references/streamdown.md](./references/streamdown.md) -- StreamdownTextPrimitive alternative

## Orientation

`MarkdownTextPrimitive` renders one text part as markdown. The registry component (`npx assistant-ui@latest add markdown-text`) generates `components/assistant-ui/markdown-text.tsx`, which exports a memoized `MarkdownText` built on the primitive plus a `defaultComponents` map from `unstable_memoizeMarkdownComponents`. Render `MarkdownText` from the `text` branch of `MessagePrimitive.Parts`.

```tsx
import "@assistant-ui/react-markdown/styles/dot.css";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import { MessagePrimitive } from "@assistant-ui/react";
import remarkGfm from "remark-gfm";
import { memo } from "react";

const MarkdownTextImpl = () => (
  <MarkdownTextPrimitive
    remarkPlugins={[remarkGfm]}
    className="aui-md"
    components={defaultComponents}
  />
);

export const MarkdownText = memo(MarkdownTextImpl);

<MessagePrimitive.Parts>
  {({ part }) => (part.type === "text" ? <MarkdownText /> : null)}
</MessagePrimitive.Parts>;
```

Add highlighting, math, or diagrams by extending the same primitive: `rehypePlugins` for KaTeX, `componentsByLanguage` for a per-language `SyntaxHighlighter` (Mermaid, diff), and `preprocess` to normalize raw text before parsing. See the references for each. For a batteries-included alternative with built-in Shiki, KaTeX, Mermaid, and block streaming, swap in `StreamdownTextPrimitive` from `@assistant-ui/react-streamdown`.

## Common Gotchas

- **Nothing renders / plain text shows.** The `text` branch must return `MarkdownText`; returning `<p>{part.text}</p>` bypasses markdown entirely.
- **No syntax highlighting.** Highlighting is not bundled. Register a `SyntaxHighlighter` in `defaultComponents` (react-shiki recommended) per the syntax-highlighting reference.
- **KaTeX has no styling.** Import `katex/dist/katex.min.css` once at the app root; `rehypeKatex` only emits markup.
- **Mermaid parses partial diagrams while streaming.** Gate rendering on stream completion (the reference uses `useAuiState` to detect the closing fence) instead of rendering every delta.
- **Memoization export name.** The package exports `unstable_memoizeMarkdownComponents`; the generated file aliases it to `memoizeMarkdownComponents`.
- **Unstyled by default.** The `aui-md` class and `styles/dot.css` provide base styling; add your own Tailwind/CSS otherwise.

## Related Skills

- **primitives** -- general UI composition (`ThreadPrimitive`, `ComposerPrimitive`, `MessagePrimitive.Parts`) for assembling the message and the rest of the chat surface around the markdown text branch.
