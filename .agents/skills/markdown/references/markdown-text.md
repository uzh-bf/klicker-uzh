# MarkdownText

The `MarkdownText` component renders an assistant message's text part as markdown. It wraps `MarkdownTextPrimitive` from `@assistant-ui/react-markdown` with a memoized component map, a `CodeHeader`, and the package's CSS. You register it in the `MessagePrimitive.Parts` text branch so only `text` parts render as markdown.

## Contents

- [Package and CSS import](#package-and-css-import)
- [The MarkdownText component](#the-markdowntext-component)
- [remarkPlugins and rehypePlugins](#remarkplugins-and-rehypeplugins)
- [unstable_memoizeMarkdownComponents and defaultComponents](#unstable_memoizemarkdowncomponents-and-defaultcomponents)
- [CodeHeader](#codeheader)
- [Wiring into MessagePrimitive.Parts](#wiring-into-messageprimitiveparts)

## Package and CSS import

Everything lives in `@assistant-ui/react-markdown`. Import the stylesheet once (the `dot.css` ships the default `aui-md-*` styles and the streaming cursor) and pull in the primitive plus the memoization helper.

```ts
import "@assistant-ui/react-markdown/styles/dot.css";
import {
  type CodeHeaderProps,
  MarkdownTextPrimitive,
  unstable_memoizeMarkdownComponents as memoizeMarkdownComponents,
  useIsMarkdownCodeBlock,
} from "@assistant-ui/react-markdown";
import remarkGfm from "remark-gfm";
```

The helper is exported as `unstable_memoizeMarkdownComponents`; the generated `markdown-text.tsx` aliases it to `memoizeMarkdownComponents`.

## The MarkdownText component

`MarkdownTextPrimitive` reads the current text part from context, so it takes no `children`. Pass `remarkPlugins`, a `className`, and the memoized `components` map, then memoize the wrapper since the text part re-renders on every streamed token.

```tsx
const MarkdownTextImpl = () => {
  return (
    <MarkdownTextPrimitive
      remarkPlugins={[remarkGfm]}
      className="aui-md"
      components={defaultComponents}
    />
  );
};

export const MarkdownText = memo(MarkdownTextImpl);
```

Other props worth knowing: `componentsByLanguage` (per-language `SyntaxHighlighter` / `CodeHeader` overrides, see `syntax-highlighting.md`), `smooth` (toggles the smooth streaming animation), and `preprocess` (transform the raw text before markdown parsing).

## remarkPlugins and rehypePlugins

`MarkdownTextPrimitiveProps` extends `react-markdown`'s `Options`, so both `remarkPlugins` and `rehypePlugins` are forwarded as-is. `remarkGfm` is the common default (tables, strikethrough, task lists). Add `rehypePlugins` for HTML-stage transforms; KaTeX and Mermaid wiring is covered in `latex-mermaid.md`.

```tsx
<MarkdownTextPrimitive
  remarkPlugins={[remarkGfm]}
  rehypePlugins={[]}
  className="aui-md"
  components={defaultComponents}
/>
```

## unstable_memoizeMarkdownComponents and defaultComponents

`memoizeMarkdownComponents` wraps a component map so each element only re-renders when its own subtree changes, which keeps streaming cheap. The map accepts every standard markdown HTML element plus the assistant-ui slots `CodeHeader`, `SyntaxHighlighter`, and `Pre`. Use `useIsMarkdownCodeBlock` inside `code` to distinguish inline code from fenced blocks.

```tsx
const defaultComponents = memoizeMarkdownComponents({
  h1: ({ className, ...props }) => (
    <h1 className={cn("aui-md-h1", className)} {...props} />
  ),
  p: ({ className, ...props }) => (
    <p className={cn("aui-md-p", className)} {...props} />
  ),
  pre: ({ className, ...props }) => (
    <pre className={cn("aui-md-pre", className)} {...props} />
  ),
  code: function Code({ className, ...props }) {
    const isCodeBlock = useIsMarkdownCodeBlock();
    return (
      <code
        className={cn(!isCodeBlock && "aui-md-inline-code", className)}
        {...props}
      />
    );
  },
  CodeHeader,
  // h2-h6, a, blockquote, ul, ol, hr, table, th, td, tr, li, sup
});
```

## CodeHeader

`CodeHeader` renders above each fenced code block and receives `language` and `code` typed by `CodeHeaderProps`. The default copies the block to the clipboard.

```tsx
const CodeHeader: FC<CodeHeaderProps> = ({ language, code }) => {
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  const onCopy = () => {
    if (!code || isCopied) return;
    copyToClipboard(code);
  };
  return (
    <div className="aui-code-header-root">
      <span className="aui-code-header-language">{language}</span>
      <TooltipIconButton tooltip="Copy" onClick={onCopy}>
        {!isCopied && <CopyIcon />}
        {isCopied && <CheckIcon />}
      </TooltipIconButton>
    </div>
  );
};
```

## Wiring into MessagePrimitive.Parts

`MessagePrimitive.Parts` takes a render function that receives each `{ part }`. Render `MarkdownText` only for the `text` branch; other part types fall through to their own renderers.

```tsx
import { MarkdownText } from "@/components/assistant-ui/markdown-text";

<MessagePrimitive.Parts>
  {({ part }) => (part.type === "text" ? <MarkdownText /> : null)}
</MessagePrimitive.Parts>;
```
