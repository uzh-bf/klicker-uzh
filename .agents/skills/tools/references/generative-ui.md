# Declarative Generative UI

Render agent-described React UI from a JSON spec resolved against a consumer-provided component allowlist. This is the supported replacement for hand-rolled `render_ui` tool components that returned arbitrary JSX.

## Contents

- [Overview](#overview)
- [The spec format](#the-spec-format)
- [The component allowlist](#the-component-allowlist)
- [MessagePrimitive.GenerativeUI](#messageprimitivegenerativeui)
- [Rendering inside MessagePrimitive.Parts](#rendering-inside-messageprimitiveparts)
- [GenerativeUIRenderError and Fallback](#generativeuirendererror-and-fallback)
- [The AI SDK bridge: render_gui and parseRenderGuiResult](#the-ai-sdk-bridge-render_gui-and-parserenderguiresult)
- [Server-side render_gui tool](#server-side-render_gui-tool)
- [Replacing the older render_ui pattern](#replacing-the-older-render_ui-pattern)
- [Security](#security)

## Overview

The agent emits a `generative-ui` message part carrying a JSON spec. `MessagePrimitive.GenerativeUI` walks that spec and resolves each `component` name against an allowlist you provide. Names not in the allowlist throw `GenerativeUIRenderError` unless you pass a `Fallback`. The spec is plain JSON; there is no `eval` or dynamic import. Rendering is stream friendly, so a partially streamed spec renders progressively as it fills in.

All exports live in `@assistant-ui/react`.

```tsx
import {
  MessagePrimitive,
  GenerativeUIRenderError,
  type GenerativeUISpec,
  type GenerativeUINode,
  type GenerativeUIMessagePart,
  type GenerativeUIComponentRegistry,
} from "@assistant-ui/react";
```

## The spec format

A node is either a bare string (rendered as text) or an object describing one allowlisted component. The spec wraps one or more root nodes.

```ts
export type GenerativeUINode =
  | string
  | {
      readonly component: string;
      readonly props?: Record<string, unknown>;
      readonly children?: readonly GenerativeUINode[];
      readonly key?: string;
    };

export type GenerativeUISpec = {
  readonly root: GenerativeUINode | readonly GenerativeUINode[];
};

export type GenerativeUIMessagePart = {
  readonly type: "generative-ui";
  readonly spec: GenerativeUISpec;
  readonly id?: string;
  readonly parentId?: string;
};
```

- `component` is the allowlist key resolved against your registry.
- `props` are passed to the resolved component and must be JSON serializable.
- `children` render below the component; strings become text, objects recurse.
- `key` is an optional stable React key. When omitted, the renderer derives a key from the node's path in the tree.

A native `generative-ui` part as emitted from ExternalStore or a manual message looks like this.

```json
{
  "type": "generative-ui",
  "spec": {
    "root": {
      "component": "Card",
      "props": { "title": "Welcome" },
      "children": [
        { "component": "Button", "props": { "label": "Get started" } }
      ]
    }
  }
}
```

## The component allowlist

The allowlist is a plain record from spec name to React component. Its type is `GenerativeUIComponentRegistry`, which is `Record<string, ComponentType<any>>`. Define each component to accept only the primitive, display oriented props the agent is allowed to pass.

```tsx
import type { ComponentType, PropsWithChildren } from "react";

const Card: ComponentType<
  PropsWithChildren<{ title?: string; description?: string }>
> = ({ title, description, children }) => (
  <div className="bg-card rounded-xl border p-4 shadow-sm">
    {title ? <div className="text-base font-semibold">{title}</div> : null}
    {description ? (
      <div className="text-muted-foreground mt-1 text-sm">{description}</div>
    ) : null}
    {children ? <div className="mt-3">{children}</div> : null}
  </div>
);

const Button: ComponentType<PropsWithChildren<{ label?: string }>> = ({
  label,
  children,
}) => (
  <button
    type="button"
    className="bg-primary text-primary-foreground mt-2 inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium"
  >
    {children ?? label ?? "Click"}
  </button>
);

export const componentsAllowlist = { Card, Button };
```

## MessagePrimitive.GenerativeUI

The primitive accepts the allowlist via `components`, an optional `Fallback`, and an optional `spec` override. When `spec` is omitted, it reads the `generative-ui` part from the surrounding message part context.

```tsx
type Props = {
  components: GenerativeUIComponentRegistry;
  spec?: GenerativeUISpec | undefined;
  Fallback?:
    | ComponentType<{ component: string; props?: unknown }>
    | undefined;
};
```

In the simplest case, pass the allowlist and let the primitive read the part from context.

```tsx
<MessagePrimitive.GenerativeUI components={componentsAllowlist} />
```

Pass `spec` explicitly only when you have the spec in hand, for example from the AI SDK bridge below.

## Rendering inside MessagePrimitive.Parts

`MessagePrimitive.Parts` accepts a `generativeUI` entry in its `components` map. Provide the allowlist there and the primitive renders any `generative-ui` part automatically.

```tsx
<MessagePrimitive.Parts
  components={{
    generativeUI: {
      components: componentsAllowlist,
      Fallback: UnknownComponentFallback,
    },
  }}
/>
```

When you fork the thread to hand render part types with `MessagePrimitive.GroupedParts`, handle the `generative-ui` case explicitly.

```tsx
case "generative-ui":
  return (
    <MessagePrimitive.GenerativeUI
      components={componentsAllowlist}
      Fallback={UnknownComponentFallback}
    />
  );
```

If a `generative-ui` part arrives but no allowlist was wired, the primitive renders nothing and warns in development. The default shadcn `Thread` does not wire this, so opt in explicitly.

## GenerativeUIRenderError and Fallback

The allowlist is the security boundary. A spec that references a component name absent from the allowlist throws `GenerativeUIRenderError`, which carries a typed `componentName` field.

```ts
export class GenerativeUIRenderError extends Error {
  public readonly componentName: string;
}
```

The default message is `Component "<name>" is not in the generative-ui allowlist.`. Catch it with a React error boundary, or pass a `Fallback` to opt into a soft fail UX. The `Fallback` receives the unresolved `component` name and the attempted `props`.

```tsx
const UnknownComponentFallback = ({ component }: { component: string }) => (
  <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
    unknown component: {component}
  </span>
);

<MessagePrimitive.GenerativeUI
  components={componentsAllowlist}
  Fallback={UnknownComponentFallback}
/>;
```

## The AI SDK bridge: render_gui and parseRenderGuiResult

With `useChatRuntime`, the AI SDK maps a tool result to a `tool-call` part rather than a native `generative-ui` part. Bridge it by calling a `render_gui` tool whose result carries the spec, then parse that result and feed it to the primitive. This is an interim bridge; the native part path above is preferred when available.

`parseRenderGuiResult` validates the tool result against the spec schema and returns the `GenerativeUISpec`, or `undefined` if it does not match.

```ts
import type { GenerativeUISpec } from "@assistant-ui/react";

export const parseRenderGuiResult = (
  result: unknown,
): GenerativeUISpec | undefined => { /* zod safeParse of { spec } */ };
```

Wire it in the `tool-call` case. When the spec parses, render through the primitive with the explicit `spec` prop.

```tsx
case "tool-call":
  if (part.toolName === "render_gui") {
    const spec = parseRenderGuiResult(part.result);
    if (spec) {
      return (
        <MessagePrimitive.GenerativeUI
          spec={spec}
          components={componentsAllowlist}
          Fallback={UnknownComponentFallback}
        />
      );
    }
  }
  return part.toolUI ?? <ToolFallback {...part} />;
```

Two further details keep the bridge clean. Exclude `render_gui` from any tool group chrome so the call does not render as a generic tool card; for example return an empty group array for it in `groupBy`. The spec arrives only at tool completion through `part.result`, not incrementally, so this path does not stream.

```tsx
groupBy={(part) => {
  if (part.type === "tool-call" && part.toolName === "render_gui") return [];
  return [];
}}
```

## Server-side render_gui tool

Define the tool with the AI SDK `tool` helper and return the spec from `execute`. The input and result both carry `{ spec }`, validated by a zod schema.

```ts
import { streamText, tool, zodSchema } from "ai";
import { z } from "zod";

const generativeUINodeSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.object({
      component: z.string().min(1),
      props: z.record(z.string(), z.unknown()).optional(),
      children: z.array(generativeUINodeSchema).optional(),
      key: z.string().optional(),
    }),
  ]),
);

const renderGuiToolInputSchema = z.object({
  spec: z.object({
    root: z.union([
      generativeUINodeSchema,
      z.array(generativeUINodeSchema).min(1),
    ]),
  }),
});

const result = streamText({
  model,
  messages,
  tools: {
    render_gui: tool({
      description:
        "Compose inline UI from the allowlisted component library. " +
        "Pass a JSON spec with a root node tree.",
      inputSchema: zodSchema(renderGuiToolInputSchema),
      execute: async (input) => ({ spec: input.spec }),
    }),
  },
});
```

Instruct the model to call `render_gui` for UI requests and to keep its text reply brief, so it does not paste the JSON spec or the tool result back into the message text.

## Replacing the older render_ui pattern

The older approach defined a tool such as `render_ui` and a hand written tool UI component that interpreted an ad hoc payload and returned arbitrary JSX. That coupled the rendering contract to one component, offered no allowlist boundary, and reimplemented spec walking per project.

The declarative path replaces it. Components describe what they can render through the allowlist, the agent describes what to render through the `{ component, props, children }` spec, and `MessagePrimitive.GenerativeUI` walks the tree once with a typed error boundary. Prefer the native `generative-ui` part when your runtime emits it, and use the `render_gui` plus `parseRenderGuiResult` bridge as the interim path on the AI SDK runtime.

## Security

The allowlist bounds which components render; it does not constrain the props those components receive. Treat every allowlisted component as receiving untrusted input.

- Never pass agent supplied props to `dangerouslySetInnerHTML`.
- Validate or block `javascript:` URLs in `href` and `src`.
- Prefer primitive, display oriented props; avoid event handlers or escape hatches that an agent supplied value could drive.
