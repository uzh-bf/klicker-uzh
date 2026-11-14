# DevTools

Inspect assistant-ui runtime state, context, and events in the browser without `console.log`.

## Installation

```bash
npm install @assistant-ui/react-devtools
```

The package peer-depends on `@assistant-ui/react` (`^0.15.0`) and `@assistant-ui/tap` (`^0.9.0`); it reads from the same Assistant API context, so it only works inside a runtime provider.

## Basic Setup

Render `<DevToolsModal />` as a child of `AssistantRuntimeProvider`, alongside your assistant UI. In development builds a floating button appears in the lower-right corner; clicking it opens the inspector.

```tsx
"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { DevToolsModal } from "@assistant-ui/react-devtools";
import { Thread } from "@/components/assistant-ui/thread";

export function Assistant() {
  const runtime = useChatRuntime();

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <DevToolsModal />
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

## Dev-Only by Default

`DevToolsModal` is self-guarding: it returns `null` when `process.env.NODE_ENV === "production"`, so bundlers eliminate it via dead code elimination. You can leave it mounted without shipping the inspector to production and without writing your own environment check.

```tsx
// no manual guard needed; this renders nothing in production builds
<DevToolsModal />
```

Note: the guard keys off `process.env.NODE_ENV`. If your bundler does not define it (some non-standard setups), gate the render yourself.

```tsx
{process.env.NODE_ENV !== "production" && <DevToolsModal />}
```

## Inline Panel

`DevToolsPanel` embeds the same inspector inline instead of behind a modal button. Use it to dock DevTools into a panel of your own layout.

```tsx
import { DevToolsPanel } from "@assistant-ui/react-devtools";

<div className="h-96 w-full">
  <DevToolsPanel theme="dark" onClose={() => setOpen(false)} />
</div>
```

`DevToolsModal` wraps a `DevToolsPanel`, so both surfaces show the same event log, context viewer, and runtime inspector.

## Theme

Both surfaces take a `theme` prop. `DevToolsModal` accepts `"dark" | "light" | "system"` and defaults to following the page; `DevToolsPanel` takes an explicit `"dark" | "light"`. Styles are isolated inside a `ShadowRoot`, so the inspector does not inherit or leak your app's CSS.

## Custom Tabs

The panel's tab list is a plugin array. `builtinPlugins` is the default set; `createDevToolsPlugin` types a custom entry.

```tsx
import {
  DevToolsModal,
  builtinPlugins,
  createDevToolsPlugin,
} from "@assistant-ui/react-devtools";

const myTab = createDevToolsPlugin({
  id: "my-tab",
  label: "My Tab",
  order: 100,
  Component: ({ client }) => <pre>{JSON.stringify(client, null, 2)}</pre>,
});

<DevToolsModal plugins={[...builtinPlugins, myTab]} />;
```

## Chrome Extension

A standalone Chrome extension consumes the same package and connects to any page running assistant-ui, so you can inspect runtime state without adding `DevToolsModal` to your app. Source lives at [`apps/devtools-extension`](https://github.com/assistant-ui/assistant-ui/tree/main/apps/devtools-extension).

## Exports

| Export | Purpose |
|-------|-------|
| `DevToolsModal` | Floating button plus modal overlay; dev-only. Props: `plugins`, `theme`, `client` |
| `DevToolsPanel` | Inline inspector surface. Props: `plugins`, `theme`, `onClose`, `client` |
| `ShadowRoot` | Style-isolated container the panel renders into |
| `builtinPlugins` / `createDevToolsPlugin` | Default tab set and helper for custom tabs |
| `DevToolsClient` / `createInProcessClient` / `inProcessClient` | Client the panel reads from; swap it to inspect a remote page |
| `serializeModelContext` / `normalizeToolList` | Serialization helpers used by custom hosts such as the Chrome extension |

Most apps only need `DevToolsModal`.
