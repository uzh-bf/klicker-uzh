# Registry Renderers for Message Parts

Prebuilt renderers for tool-call and image parts, added through the assistant-ui registry. These are not npm packages; `npx assistant-ui add` copies the component source into your project (under `components/assistant-ui/`), and `@assistant-ui/ui` is registry shorthand for those copied files, not an installable dependency. Types like `ToolCallMessagePartComponent` and `ImageMessagePart` come from `@assistant-ui/react`.

## Contents

- [Adding registry components](#adding-registry-components)
- [ToolFallback](#toolfallback)
- [ToolFallback sub-components](#toolfallback-sub-components)
- [ToolGroup](#toolgroup)
- [Grouping consecutive tool calls](#grouping-consecutive-tool-calls)
- [Image](#image)
- [Image.Actions and image generation](#imageactions-and-image-generation)

## Adding registry components

```bash
npx assistant-ui add tool-fallback
npx assistant-ui add tool-group   # also pulls tool-fallback
npx assistant-ui add image
```

Each command writes a `.tsx` file into `components/assistant-ui/`. The equivalent shadcn invocation is `npx shadcn@latest add https://r.assistant-ui.com/<name>.json`. After adding, import from your local path (or the `@assistant-ui/ui` alias):

```ts
import { ToolFallback } from "@/components/assistant-ui/tool-fallback";
import { ToolGroup } from "@/components/assistant-ui/tool-group";
import { Image } from "@/components/assistant-ui/image";
```

## ToolFallback

The default tool-call renderer: a collapsible card showing the tool name, status, arguments, and result. It implements `ToolCallMessagePartComponent`, so its props are the message part itself (`toolName`, `argsText`, `result`, `status`). Spread the part into it.

```tsx
import { MessagePrimitive } from "@assistant-ui/react";
import { ToolFallback } from "@/components/assistant-ui/tool-fallback";

<MessagePrimitive.Parts>
  {({ part }) => {
    if (part.type === "tool-call") return <ToolFallback {...part} />;
    return null;
  }}
</MessagePrimitive.Parts>
```

Props (from `ToolCallMessagePartComponent`):

```ts
{
  toolName: string;                       // name of the tool called
  argsText?: string;                      // stringified arguments
  result?: unknown;                       // execution result, undefined while running
  status?: ToolCallMessagePartStatus;     // running | complete | incomplete | requires-action
}
```

Status `type` drives the visuals: `"running"` shows a spinner and shimmer, `"complete"` a check icon, `"incomplete"` with reason `"cancelled"` a muted/strikethrough `XCircleIcon`, `"requires-action"` an alert icon.

Prefer a tool's own UI when present, falling back to `ToolFallback` otherwise:

```tsx
{({ part }) => {
  if (part.type === "tool-call") return part.toolUI ?? <ToolFallback {...part} />;
  return null;
}}
```

## ToolFallback sub-components

`ToolFallback` is composable. Drop the pieces in to customize the layout while keeping the collapse and scroll-lock behavior.

```tsx
<ToolFallback.Root>
  <ToolFallback.Trigger toolName="get_weather" status={status} />
  <ToolFallback.Content>
    <ToolFallback.Error status={status} />
    <ToolFallback.Args argsText={argsText} />
    <ToolFallback.Result result={result} />
  </ToolFallback.Content>
</ToolFallback.Root>
```

| Part | Role |
|------|------|
| `ToolFallback.Root` | Collapsible container with scroll lock; accepts `open`, `onOpenChange`, `defaultOpen` |
| `ToolFallback.Trigger` | Header with tool name, status icon, shimmer |
| `ToolFallback.Content` | Animated collapsible wrapper |
| `ToolFallback.Args` | Renders the tool arguments |
| `ToolFallback.Result` | Renders the execution result |
| `ToolFallback.Error` | Renders error or cancellation info |

The same parts are available as named exports: `ToolFallbackRoot`, `ToolFallbackTrigger`, `ToolFallbackContent`, `ToolFallbackArgs`, `ToolFallbackResult`, `ToolFallbackError`.

## ToolGroup

Collapses a run of consecutive tool calls into one expandable card. `ToolGroupRoot` wraps the run, `ToolGroupTrigger` shows the count, and `ToolGroupContent` holds the individual renderers.

```ts
import {
  ToolGroup, ToolGroupRoot, ToolGroupTrigger, ToolGroupContent, toolGroupVariants,
} from "@/components/assistant-ui/tool-group";
```

`ToolGroupRoot` props:

```ts
{
  variant?: "outline" | "ghost" | "muted";   // default "outline"
  open?: boolean;                             // controlled open state
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;                      // default false
}
```

`ToolGroupTrigger` props: `count: number` (drives the auto-pluralized `"N tool call(s)"` label) and `active?: boolean` (spinner + shimmer while a call in the group is running).

## Grouping consecutive tool calls

Use `MessagePrimitive.GroupedParts` with `groupPartByType` to fold every `"tool-call"` part into a synthetic `"group-tool"` part. The group exposes `indices` (the grouped part positions) and `status`; render its `children` inside `ToolGroupContent`, and fall back to `ToolFallback` for each `"tool-call"`.

```tsx
import { MessagePrimitive, groupPartByType } from "@assistant-ui/react";
import { ToolGroupRoot, ToolGroupTrigger, ToolGroupContent } from "@/components/assistant-ui/tool-group";
import { ToolFallback } from "@/components/assistant-ui/tool-fallback";

<MessagePrimitive.GroupedParts
  groupBy={groupPartByType({ "tool-call": ["group-tool"] })}
>
  {({ part, children }) => {
    switch (part.type) {
      case "group-tool":
        return (
          <ToolGroupRoot>
            <ToolGroupTrigger
              count={part.indices.length}
              active={part.status.type === "running"}
            />
            <ToolGroupContent>{children}</ToolGroupContent>
          </ToolGroupRoot>
        );
      case "tool-call":
        return part.toolUI ?? <ToolFallback {...part} />;
      default:
        return null;
    }
  }}
</MessagePrimitive.GroupedParts>
```

Note: a legacy `ToolGroup` wrapper with `startIndex`/`endIndex` props exists only for the deprecated `components.ToolGroup` prop on `MessagePrimitive.Parts`. New code should use `GroupedParts` with `group-tool`.

## Image

Renders an `ImageMessagePart`. It is an `ImageMessagePartComponent`, so spread the part into it. The component branches on `status`: `"running"` shows a spinner, `"incomplete"` with reason `"content-filter"` shows an error card (no `<img>`), and otherwise a zoomable image with an optional filename label.

```tsx
import { MessagePrimitive } from "@assistant-ui/react";
import { Image } from "@/components/assistant-ui/image";

<MessagePrimitive.Parts>
  {({ part }) => {
    if (part.type === "image") return <Image {...part} />;
    return null;
  }}
</MessagePrimitive.Parts>
```

`Image.Root` (`ImageRootProps` = `ComponentProps<"div"> & VariantProps<typeof imageVariants>`) accepts:

- `variant`: `"outline"` (default, border) | `"ghost"` (no border) | `"muted"` (background fill)
- `size`: `"sm"` (`max-w-64`) | `"default"` (`max-w-96`) | `"lg"` (`max-w-[512px]`) | `"full"` (`w-full`)

Sub-components and named exports: `Image.Root` / `ImageRoot`, `Image.Preview` / `ImagePreview`, `Image.Filename` / `ImageFilename`, `Image.Zoom` / `ImageZoom`, `Image.Actions` / `ImageActions`, `Image.Generating` / `ImageGenerating`, `Image.ContentFilterError` / `ImageContentFilterError`, plus `imageVariants`.

## Image.Actions and image generation

Generate images in a backend route with the AI SDK, then render the resulting data URL as an `ImageMessagePart`. Keep the part minimal: only `type` and `image` (a `data:`, `https://`, or `blob:` URL). Provenance like the prompt belongs in component state or message metadata, not the part.

```ts
// app/api/image/route.ts
import { generateImage } from "ai";
import { openai } from "@ai-sdk/openai";

export async function POST(req: Request) {
  const { prompt } = await req.json();
  const result = await generateImage({ model: openai.image("gpt-image-1"), prompt });
  return Response.json({
    image: `data:${result.image.mediaType};base64,${result.image.base64}`,
  });
}
```

```tsx
import { Image } from "@/components/assistant-ui/image";
import type { ImageMessagePart } from "@assistant-ui/react";

const imagePart: ImageMessagePart = { type: "image", image: result.image };

<>
  <Image {...imagePart} />
  <Image.Actions part={imagePart} onRegenerate={() => regenerate(prompt)} />
</>
```

`Image.Actions` (`ImageActionsProps`) renders download, copy, and an optional regenerate button. It takes `part: ImageMessagePart`, an optional `onRegenerate?: () => void | Promise<void>` (the regenerate button only appears when supplied), and an optional `className`. A full Next.js example lives at `examples/with-image-generation` in the assistant-ui repository.
