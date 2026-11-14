# Syntax Highlighting

Code block highlighting for the markdown renderer. Two options: `react-shiki` (recommended) and `@assistant-ui/react-syntax-highlighter` (legacy, may be removed). Both plug in as a `SyntaxHighlighter` component, either globally via `defaultComponents` or per language via `componentsByLanguage`.

## Contents

- [How it plugs in](#how-it-plugs-in)
- [react-shiki (recommended)](#react-shiki-recommended)
- [Dual / multi theme](#dual--multi-theme)
- [Bundle optimization (shiki)](#bundle-optimization-shiki)
- [react-syntax-highlighter (legacy)](#react-syntax-highlighter-legacy)
- [Full language bundle](#full-language-bundle)
- [Per-language overrides (componentsByLanguage)](#per-language-overrides-componentsbylanguage)
- [SyntaxHighlighterProps](#syntaxhighlighterprops)

## How it plugs in

`MarkdownTextPrimitive` renders code blocks with the `SyntaxHighlighter` you register. A global one goes in `defaultComponents` (built with `memoizeMarkdownComponents`); language specific ones go in `componentsByLanguage`.

```tsx
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";

<MarkdownTextPrimitive
  remarkPlugins={[remarkGfm]}
  className="aui-md"
  components={defaultComponents}
  componentsByLanguage={{
    mermaid: { SyntaxHighlighter: MermaidDiagram },
  }}
/>;
```

Note: the package exports the memoization helper as `unstable_memoizeMarkdownComponents`; the generated `markdown-text.tsx` aliases it to `memoizeMarkdownComponents`.

## react-shiki (recommended)

Install via the registry (`https://r.assistant-ui.com/shiki-highlighter.json`), which adds the `react-shiki` package and `/components/assistant-ui/shiki-highlighter.tsx`.

```tsx
"use client";
import type { FC } from "react";
import ShikiHighlighter, { type ShikiHighlighterProps } from "react-shiki";
import type { SyntaxHighlighterProps as AUIProps } from "@assistant-ui/react-markdown";
import { cn } from "@/lib/utils";

export type HighlighterProps = Omit<ShikiHighlighterProps, "children" | "theme"> & {
  theme?: ShikiHighlighterProps["theme"];
} & Pick<AUIProps, "language" | "code"> &
  Partial<Pick<AUIProps, "node" | "components">>;

export const SyntaxHighlighter: FC<HighlighterProps> = ({
  code,
  language,
  theme = { dark: "kanagawa-wave", light: "kanagawa-lotus" },
  className,
  addDefaultStyles = false,
  showLanguage = false,
  node: _node,
  components: _components,
  ...props
}) => {
  return (
    <ShikiHighlighter
      {...props}
      language={language}
      theme={theme}
      addDefaultStyles={addDefaultStyles}
      showLanguage={showLanguage}
      defaultColor="light-dark()"
      className={cn(
        "aui-shiki-base [&_pre]:bg-muted/75! [&_pre]:overflow-x-auto [&_pre]:rounded-b-lg [&_pre]:p-4",
        className,
      )}
    >
      {code.trim()}
    </ShikiHighlighter>
  );
};
SyntaxHighlighter.displayName = "SyntaxHighlighter";
```

Register it in `defaultComponents` (file `markdown-text.tsx`):

```tsx
import { SyntaxHighlighter } from "./shiki-highlighter";

export const defaultComponents = memoizeMarkdownComponents({
  SyntaxHighlighter: SyntaxHighlighter,
  h1: /* ... */,
  // ...other elements...
});
```

`ShikiHighlighter` props worth knowing: `theme` (a single theme or a multi-theme object), `language` (default `"text"`), `defaultColor` (`string | false`), `delay` (highlight throttle for streaming, default `0`), `customLanguages`, and `codeToHastOptions`.

## Dual / multi theme

Pass a `{ light, dark }` object plus `defaultColor="light-dark()"`.

```tsx
<ShikiHighlighter
  theme={{ light: "github-light", dark: "github-dark" }}
  defaultColor="light-dark()"
>
  {code.trim()}
</ShikiHighlighter>
```

Wire up `color-scheme` in `globals.css`. System based:

```css
:root { color-scheme: light dark; }
```

Class based:

```css
:root { color-scheme: light; }
:root.dark { color-scheme: dark; }
```

## Bundle optimization (shiki)

Use the web bundle (smaller, web-focused languages):

```tsx
import ShikiHighlighter, { type ShikiHighlighterProps } from "react-shiki/web";
```

Or build a custom core highlighter with only the themes and languages you need, then pass it via the `highlighter` prop:

```tsx
import { createHighlighterCore, createOnigurumaEngine } from "react-shiki/core";

const customHighlighter = await createHighlighterCore({
  themes: [import("@shikijs/themes/nord")],
  langs: [
    import("@shikijs/langs/javascript"),
    import("@shikijs/langs/typescript"),
  ],
  engine: createOnigurumaEngine(import("shiki/wasm")),
});

<SyntaxHighlighter {...props} language={language} theme={theme} highlighter={customHighlighter} />;
```

## react-syntax-highlighter (legacy)

Install via the registry (`https://r.assistant-ui.com/syntax-highlighter.json`), which adds `@assistant-ui/react-syntax-highlighter`, `react-syntax-highlighter`, `@types/react-syntax-highlighter`, and `/components/assistant-ui/syntax-highlighter.tsx`. The light build only ships the languages you register.

```tsx
import { PrismAsyncLight } from "react-syntax-highlighter";
import { makePrismAsyncLightSyntaxHighlighter } from "@assistant-ui/react-syntax-highlighter";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import { coldarkDark } from "react-syntax-highlighter/dist/cjs/styles/prism";

PrismAsyncLight.registerLanguage("js", tsx);
PrismAsyncLight.registerLanguage("jsx", tsx);
PrismAsyncLight.registerLanguage("ts", tsx);
PrismAsyncLight.registerLanguage("tsx", tsx);
PrismAsyncLight.registerLanguage("python", python);

export const SyntaxHighlighter = makePrismAsyncLightSyntaxHighlighter({
  style: coldarkDark,
  customStyle: {
    margin: 0,
    width: "100%",
    background: "black",
    padding: "1.5rem 1rem",
  },
});
```

Register it the same way:

```tsx
import { SyntaxHighlighter } from "./syntax-highlighter";

export const defaultComponents = memoizeMarkdownComponents({
  SyntaxHighlighter: SyntaxHighlighter,
  h1: /* ... */,
  // ...other elements...
});
```

## Full language bundle

For all languages without registering each one, use the `/full` subpath and `makePrismAsyncSyntaxHighlighter` instead of the light builder.

```tsx
import { makePrismAsyncSyntaxHighlighter } from "@assistant-ui/react-syntax-highlighter/full";
```

## Per-language overrides (componentsByLanguage)

`componentsByLanguage` maps a language id to its own `SyntaxHighlighter` (and optional `CodeHeader`). It takes precedence over the global `SyntaxHighlighter` in `components` for that language; other languages fall back to the global one. This is how Mermaid and diff renderers are wired.

```tsx
const MarkdownTextImpl = () => {
  return (
    <MarkdownTextPrimitive
      remarkPlugins={[remarkGfm]}
      className="aui-md"
      components={defaultComponents}
      componentsByLanguage={{
        mermaid: {
          SyntaxHighlighter: MermaidDiagram,
        },
      }}
    />
  );
};

export const MarkdownText = memo(MarkdownTextImpl);
```

## SyntaxHighlighterProps

Every `SyntaxHighlighter` (global or per language) receives this from `@assistant-ui/react-markdown`:

```ts
export type SyntaxHighlighterProps = {
  node?: Element | undefined;
  components: {
    Pre: PreComponent;
    Code: CodeComponent;
  };
  language: string;
  code: string;
};
```

`language` falls back to `"unknown"` when the fence has no language; `code` is the raw block text. The shiki and prism components destructure `node` and `components` out and forward the rest, since `react-shiki` and `react-syntax-highlighter` render their own `pre`/`code`.
