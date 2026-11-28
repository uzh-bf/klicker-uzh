# react-o11y

Headless primitives for visualizing observability spans (traces, waterfalls) from any span source.

The primitives and `SpanResource` ship from `@assistant-ui/react-o11y` (experimental). Spans are mounted as a Tap resource with `useAui` and read with `useAuiState` from `@assistant-ui/store`. Feed it any data that matches the `SpanData` shape; the resource computes depth, `hasChildren`, `timeRange`, and collapse state for you.

## Contents

- [Imports](#imports)
- [SpanData input](#spandata-input)
- [SpanResource](#spanresource)
- [SpanState](#spanstate)
- [SpanPrimitive components](#spanprimitive-components)
- [SpanByIndexProvider](#spanbyindexprovider)
- [Full trace view](#full-trace-view)

## Imports

```tsx
import {
  SpanPrimitive,
  SpanResource,
  SpanByIndexProvider,
  type SpanData,
} from "@assistant-ui/react-o11y";
import { useAui, AuiProvider, useAuiState } from "@assistant-ui/store";
```

## SpanData input

Raw spans you pass in. `parentSpanId` is `null` for roots, `endedAt`/`latencyMs` are `null` while running.

```ts
type SpanData = {
  id: string;
  parentSpanId: string | null;
  name: string;
  type: string; // category, e.g. "llm" or "tool"
  status: "running" | "completed" | "failed" | "skipped";
  startedAt: number; // ms
  endedAt: number | null;
  latencyMs: number | null;
};
```

## SpanResource

A Tap resource that ingests raw spans and produces reactive, tree-aware state. Mount it with `useAui`, then provide the result through `AuiProvider`.

```tsx
const aui = useAui({ span: SpanResource({ spans }) });
```

## SpanState

The computed state for a span, available via `useAuiState((s) => s.span)` inside any span-scoped subtree. Extends `SpanData` with `depth`, `hasChildren`, `isCollapsed`, `children`, and `timeRange`.

```ts
type SpanState = SpanData & {
  depth: number;
  hasChildren: boolean;
  isCollapsed: boolean;
  children: SpanItemState[];
  timeRange: { min: number; max: number };
};
```

## SpanPrimitive components

All components forward refs and accept `className`, `style`, and standard DOM props. State is exposed through data attributes for styling.

- `SpanPrimitive.Root`: container `<div>` exposing `data-span-id`, `data-span-status`, `data-span-type`, `data-span-depth`, and `data-collapsed`.
- `SpanPrimitive.Indent`: `<div>` whose left padding is `baseIndent + depth * indentPerLevel`. Props `baseIndent` (default `8`) and `indentPerLevel` (default `12`), both px.
- `SpanPrimitive.CollapseToggle`: `<button>` that toggles collapse, rendered only when the span has children. Exposes `data-collapsed` and stops click propagation.
- `SpanPrimitive.StatusIndicator`: `<span>` exposing `data-span-status`, with no built-in glyph.
- `SpanPrimitive.TypeBadge`: `<span>` defaulting its children to `span.type`; override by passing custom children.
- `SpanPrimitive.Name`: `<span>` defaulting its children to `span.name`; override by passing custom children.
- `SpanPrimitive.Children`: iterates visible (non-collapsed) spans, wrapping each in `SpanByIndexProvider`.
- `SpanPrimitive.ChildByIndex`: renders a single child by `index`, useful for virtualization.

```tsx
<SpanPrimitive.StatusIndicator
  className="size-2 rounded-full
    data-[span-status=running]:bg-yellow-500
    data-[span-status=completed]:bg-green-500
    data-[span-status=failed]:bg-red-500
    data-[span-status=skipped]:bg-gray-400"
/>
```

`SpanPrimitive.Children` and `SpanPrimitive.ChildByIndex` take either a render prop or a memoized `components.Span`. Prefer the component form.

```tsx
<SpanPrimitive.Children components={{ Span: SpanRow }} />
<SpanPrimitive.ChildByIndex index={0} components={{ Span: SpanRow }} />
```

## SpanByIndexProvider

Lower-level provider that scopes a subtree to the span at `index`. `SpanPrimitive.Children` wires this up for you, so reach for it directly only when rendering rows manually.

```tsx
<SpanByIndexProvider index={0}>
  <SpanPrimitive.Root>{/* reads the span at index 0 */}</SpanPrimitive.Root>
</SpanByIndexProvider>
```

## Full trace view

A recursive `SpanRow` renders one span and its children; `TraceView` mounts the resource and renders the roots.

```tsx
"use client";
import { SpanPrimitive, SpanResource, type SpanData } from "@assistant-ui/react-o11y";
import { useAui, AuiProvider } from "@assistant-ui/store";

function SpanRow() {
  return (
    <SpanPrimitive.Root className="flex items-center gap-2 py-1">
      <SpanPrimitive.Indent />
      <SpanPrimitive.CollapseToggle className="size-4 cursor-pointer">
        ▸
      </SpanPrimitive.CollapseToggle>
      <SpanPrimitive.StatusIndicator className="size-2 rounded-full" />
      <SpanPrimitive.TypeBadge className="rounded bg-muted px-1.5 text-xs" />
      <SpanPrimitive.Name className="text-sm" />
      <SpanPrimitive.Children components={{ Span: SpanRow }} />
    </SpanPrimitive.Root>
  );
}

export function TraceView({ spans }: { spans: SpanData[] }) {
  const aui = useAui({ span: SpanResource({ spans }) });
  return (
    <AuiProvider value={aui}>
      <SpanPrimitive.Children components={{ Span: SpanRow }} />
    </AuiProvider>
  );
}
```
