# StreamdownTextPrimitive

`@assistant-ui/react-streamdown` is a feature-rich alternative to `MarkdownTextPrimitive` with built-in Shiki syntax highlighting, KaTeX math, and Mermaid diagrams, plus block-based streaming. Powered by Vercel Streamdown.

## Contents

- [Install](#install)
- [Basic usage](#basic-usage)
- [Plugins (Shiki, KaTeX, Mermaid, CJK)](#plugins-shiki-katex-mermaid-cjk)
- [Props](#props)
- [Streaming mode and caret](#streaming-mode-and-caret)
- [Mermaid options](#mermaid-options)
- [Incomplete markdown (remend)](#incomplete-markdown-remend)
- [Security and link safety](#security-and-link-safety)
- [Custom code components](#custom-code-components)
- [Migrating from react-markdown](#migrating-from-react-markdown)
- [CSS setup](#css-setup)
- [Exports](#exports)

## Install

```bash
npm install @assistant-ui/react-streamdown streamdown
```

Plugins ship as separate optional packages: `@streamdown/code`, `@streamdown/math`, `@streamdown/mermaid`, `@streamdown/cjk`.

## Basic usage

`StreamdownTextPrimitive` replaces the text part renderer. Define a wrapper and render it from `MessagePrimitive.Parts`.

```tsx
import { StreamdownTextPrimitive } from "@assistant-ui/react-streamdown";

const StreamdownText = () => <StreamdownTextPrimitive />;

<MessagePrimitive.Parts>
  {({ part }) => (part.type === "text" ? <StreamdownText {...part} /> : null)}
</MessagePrimitive.Parts>;
```

## Plugins (Shiki, KaTeX, Mermaid, CJK)

Pass plugins through the `plugins` prop. Each is imported from its own package; math also needs the KaTeX stylesheet.

```tsx
import { StreamdownTextPrimitive } from "@assistant-ui/react-streamdown";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import "katex/dist/katex.min.css";

const StreamdownText = () => (
  <StreamdownTextPrimitive
    plugins={{ code, math, mermaid }}
    shikiTheme={["github-light", "github-dark"]}
  />
);
```

`@streamdown/cjk` adds CJK rendering optimizations via `import { cjk } from "@streamdown/cjk"` and `plugins={{ cjk }}`. `shikiTheme` is a `[light, dark]` tuple and defaults to `["github-light", "github-dark"]`.

## Props

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `mode` | `"streaming" \| "static"` | `"streaming"` | Block-based streaming vs static render |
| `plugins` | `PluginConfig` | | `code`, `math`, `mermaid`, `cjk` |
| `shikiTheme` | `[string, string]` | `["github-light", "github-dark"]` | Light/dark themes |
| `components` | `object` | | Override `SyntaxHighlighter`, `CodeHeader` |
| `componentsByLanguage` | `object` | | Per-language component overrides |
| `preprocess` | `(text: string) => string` | | Text preprocessor |
| `controls` | `boolean \| ControlsConfig` | `true` | Copy/download/fullscreen UI |
| `caret` | `"block" \| "circle"` | | Streaming caret style |
| `mermaid` | `MermaidOptions` | | Mermaid config and error handling |
| `linkSafety` | `LinkSafetyConfig` | | External link confirmation |
| `remend` | `RemendConfig` | | Incomplete markdown handling |
| `allowedTags` | `Record<string, string[]>` | | HTML tag whitelist |
| `security` | `SecurityConfig` | | URL/image restrictions |
| `containerProps` | `object` | | Props for the container div |
| `containerClassName` | `string` | | Container class name |
| `remarkRehypeOptions` | `object` | | remark-rehype options |
| `BlockComponent` | `ComponentType<BlockProps>` | | Custom block renderer |
| `parseMarkdownIntoBlocksFn` | `(md: string) => string[]` | | Custom block parser |
| `parseIncompleteMarkdown` | `boolean` | `false` | Toggle remend processing |

## Streaming mode and caret

`mode="streaming"` (the default) parses markdown into blocks so completed blocks stay stable while the last block grows. The `caret` prop renders a typing indicator at the stream tail.

```tsx
<StreamdownTextPrimitive caret="block" />   // ▋
<StreamdownTextPrimitive caret="circle" />  // ●
```

## Mermaid options

Configure the underlying Mermaid instance and supply a custom error renderer.

```tsx
<StreamdownTextPrimitive
  plugins={{ mermaid }}
  mermaid={{
    config: { theme: "dark" },
    errorComponent: ({ error, chart, retry }) => (
      <div>
        <p>Failed to render diagram: {error}</p>
        <button onClick={retry}>Retry</button>
      </div>
    ),
  }}
/>
```

## Incomplete markdown (remend)

During streaming, markdown is often syntactically incomplete (an unclosed `**`, a half-typed link). The `remend` config controls which constructs get auto-completed for display.

```tsx
<StreamdownTextPrimitive
  remend={{
    links: true,
    images: true,
    linkMode: "protocol",
    bold: true,
    italic: true,
    boldItalic: true,
    inlineCode: true,
    strikethrough: true,
    katex: true,
    setextHeadings: true,
    handlers: [],
  }}
/>
```

## Security and link safety

`security` restricts which URLs and images are allowed to render; `linkSafety` adds a confirmation step before navigating external links.

```tsx
<StreamdownTextPrimitive
  security={{
    allowedLinkPrefixes: ["https://example.com", "https://docs.example.com"],
    allowedImagePrefixes: ["https://cdn.example.com"],
    allowedProtocols: ["https", "mailto"],
    allowDataImages: false,
    defaultOrigin: "https://example.com",
    blockedLinkClass: "blocked-link",
    blockedImageClass: "blocked-image",
  }}
  linkSafety={{
    enabled: true,
    onLinkCheck: (url) => url.startsWith("https://trusted.com"),
  }}
/>
```

`allowedTags` whitelists raw HTML tags and their attributes:

```tsx
<StreamdownTextPrimitive
  allowedTags={{
    div: ["class", "id"],
    span: ["class", "style"],
    iframe: ["src", "width", "height"],
  }}
/>
```

## Custom code components

Override the highlighter and code header per language, or build a custom code component using the provided hooks.

```tsx
<StreamdownTextPrimitive
  components={{
    SyntaxHighlighter: MySyntaxHighlighter,
    CodeHeader: MyCodeHeader,
  }}
  componentsByLanguage={{
    mermaid: { SyntaxHighlighter: MermaidRenderer },
  }}
/>
```

`useIsStreamdownCodeBlock` distinguishes block code from inline code; `useStreamdownPreProps` exposes the `<pre>` props for the current block.

```tsx
import {
  useIsStreamdownCodeBlock,
  useStreamdownPreProps,
} from "@assistant-ui/react-streamdown";

function MyCodeComponent({ children, ...props }) {
  const isCodeBlock = useIsStreamdownCodeBlock();
  const preProps = useStreamdownPreProps();
  if (!isCodeBlock) {
    return (
      <code className="inline-code" {...props}>
        {children}
      </code>
    );
  }
  return (
    <pre className={preProps?.className}>
      <code {...props}>{children}</code>
    </pre>
  );
}
```

## Migrating from react-markdown

Existing custom renderers map onto the `components` and `componentsByLanguage` props, so a `react-markdown` based `MarkdownText` can be ported without rewriting the highlighter or header.

```tsx
const StreamdownText = () => (
  <StreamdownTextPrimitive
    components={{
      SyntaxHighlighter: MySyntaxHighlighter,
      CodeHeader: MyCodeHeader,
    }}
    componentsByLanguage={{
      mermaid: { SyntaxHighlighter: MermaidRenderer },
    }}
  />
);
```

## CSS setup

Streamdown assumes shadcn/ui design tokens (`--background`, `--muted-foreground`, `--border`, etc.). With Tailwind v4, add an `@source` directive for each installed package so its classes are not purged.

```css
@import "tailwindcss";
@source "../node_modules/streamdown/dist/*.js";
@source "../node_modules/@streamdown/code/dist/*.js";
@source "../node_modules/@streamdown/math/dist/*.js";
@source "../node_modules/@streamdown/mermaid/dist/*.js";
@source "../node_modules/@streamdown/cjk/dist/*.js";
```

For the word-level fade-in animation, also import the stylesheet at the app entry:

```ts
import "streamdown/styles.css";
```

Note: without these directives the copy/download/fullscreen controls render with no padding or cursor styling and the `caret` indicator stays invisible.

## Exports

```ts
import {
  StreamdownTextPrimitive,
  StreamdownContext,
  parseMarkdownIntoBlocks,
  useIsStreamdownCodeBlock,
  useStreamdownPreProps,
  memoCompareNodes,
  DEFAULT_SHIKI_THEME,
} from "@assistant-ui/react-streamdown";

import type {
  StreamdownTextPrimitiveProps,
  SyntaxHighlighterProps,
  CodeHeaderProps,
  ComponentsByLanguage,
  StreamdownTextComponents,
  PluginConfig,
  CaretStyle,
  ControlsConfig,
  MermaidOptions,
  MermaidErrorComponentProps,
  LinkSafetyConfig,
  RemendConfig,
  SecurityConfig,
  BlockProps,
} from "@assistant-ui/react-streamdown";
```
