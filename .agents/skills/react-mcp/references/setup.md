# MCP manager setup

Mount user-managed MCP servers on the `aui` instance with `@assistant-ui/react-mcp`. Connectors are presets, storage persists servers and tokens, and `aui.mcp` drives the manager imperatively.

## Contents

- [Imports](#imports)
- [defineConnector](#defineconnector)
- [McpManagerResource](#mcpmanagerresource)
- [Mount on the provider](#mount-on-the-provider)
- [Storage](#storage)
- [McpCustomStorage](#mcpcustomstorage)
- [Imperative API](#imperative-api)

## Imports

```ts
import { AuiProvider, useAui } from "@assistant-ui/react";
import {
  McpManagerResource,
  defineConnector,
  McpLocalStorage,
  McpMemoryStorage,
  McpCustomStorage,
} from "@assistant-ui/react-mcp";
```

## defineConnector

A connector is an app-declared preset the end user can connect to. `id`, `name`, `url`, and `auth` are required; `icon` is optional. Auth is one of `{ type: "none" }`, `{ type: "bearer", token? }`, or `{ type: "oauth", scopes?, ... }` (see [oauth.md](./oauth.md) for the full shapes).

```ts
const connectors = [
  defineConnector({
    id: "linear",
    name: "Linear",
    url: "https://mcp.linear.app",
    auth: { type: "oauth", scopes: ["read"] },
    icon: "/icons/linear.svg",
  }),
  defineConnector({
    id: "weather",
    name: "Weather",
    url: "https://mcp.example.com/weather",
    auth: { type: "none" },
  }),
];
```

## McpManagerResource

`McpManagerResource(options)` builds the `mcp` scope you pass to `useAui`. Options and their defaults:

- `connectors`: the array from `defineConnector(...)`.
- `storage`: `McpLocalStorage()` by default; persists under the `aui-mcp:` prefix in `window.localStorage`.
- `oauthRedirectUri`: `"${window.location.origin}/mcp/callback"` by default.
- `autoConnect`: `true` by default; connects on mount when usable auth is already persisted.

```ts
McpManagerResource({
  connectors,
  storage: McpLocalStorage(),
  oauthRedirectUri: `${window.location.origin}/auth/mcp`,
  autoConnect: true,
});
```

## Mount on the provider

Pass the resource to `useAui({ mcp })` and wrap the app in `AuiProvider`. Connected servers' tools merge into the chat runtime automatically, namespaced `serverId__toolName`.

```tsx
"use client";
import { AuiProvider, useAui } from "@assistant-ui/react";
import { McpManagerResource, defineConnector } from "@assistant-ui/react-mcp";

const connectors = [
  defineConnector({
    id: "linear",
    name: "Linear",
    url: "https://mcp.linear.app",
    auth: { type: "oauth", scopes: ["read"] },
  }),
];

export function Providers({ children }: { children: React.ReactNode }) {
  const aui = useAui({ mcp: McpManagerResource({ connectors }) });
  return <AuiProvider value={aui}>{children}</AuiProvider>;
}
```

## Storage

Three built-in storage backends control where custom servers and OAuth tokens persist:

- `McpLocalStorage()`: default; `window.localStorage` under the `aui-mcp:` prefix. Browser only.
- `McpMemoryStorage()`: in-process Map; use for SSR or tests where `localStorage` is absent.
- `McpCustomStorage({...})`: bring your own load/save handlers (for example a backend endpoint).

`McpLocalStorage` keeps tokens in plain text and is XSS-exposed; for anything past local prototyping, back `McpCustomStorage` with an HTTP-only-cookie endpoint.

```ts
McpManagerResource({ connectors, storage: McpMemoryStorage() });
```

## McpCustomStorage

Supply async handlers for custom-server records and per-server auth state. `loadAuthState` returns the stored state or `null`; `saveAuthState` and `clearAuthState` are keyed by server id.

```ts
const aui = useAui({
  mcp: McpManagerResource({
    connectors,
    storage: McpCustomStorage({
      loadCustomServers: async () =>
        fetch("/api/mcp/servers").then((r) => r.json()),
      saveCustomServers: async (records) =>
        fetch("/api/mcp/servers", {
          method: "PUT",
          body: JSON.stringify(records),
        }),
      loadAuthState: async (id) =>
        fetch(`/api/mcp/auth/${id}`).then((r) => (r.ok ? r.json() : null)),
      saveAuthState: async (id, state) =>
        fetch(`/api/mcp/auth/${id}`, {
          method: "PUT",
          body: JSON.stringify(state),
        }),
      clearAuthState: async (id) =>
        fetch(`/api/mcp/auth/${id}`, { method: "DELETE" }),
    }),
  }),
});
```

## Imperative API

Drive the manager through `useAui().mcp` from inside event handlers, never during render. `addCustomServer` registers a user server with its own auth; `server({ id })` scopes to one server for `connect` and `callTool`.

```ts
const aui = useAui();
// inside an event handler:
await aui.mcp.addCustomServer({ name, url, auth: { type: "bearer", token } });
await aui.mcp.server({ id }).connect();
const result = await aui.mcp.server({ id }).callTool("echo", { text: "hi" });
```

Read reactive state with `useAuiState` from `@assistant-ui/store`, scoped under `s.mcp` (manager) and `s.mcpServer` (current item inside a `McpServerPrimitive` subtree).

```ts
import { useAuiState } from "@assistant-ui/store";

const isHydrated = useAuiState((s) => s.mcp.isHydrated);
const connectionState = useAuiState((s) => s.mcpServer.connectionState);
```
