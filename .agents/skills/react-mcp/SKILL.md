---
name: react-mcp
description: "Lets end users add, authenticate, and manage MCP servers from the browser in assistant-ui apps with @assistant-ui/react-mcp. Use when building user-managed MCP server UIs: mounting McpManagerResource via useAui({ mcp }), declaring presets with defineConnector, dropping in McpConfigDialog, or composing McpManagerPrimitive (Root, Connectors, CustomServers, AddCustomTrigger), McpServerPrimitive (Root, Name, Icon, Status, ConnectButton, DisconnectButton, OAuthLink, RemoveButton, Error, Tools, ToolName), McpAddFormPrimitive (NameField, UrlField, AuthSelect, AuthFields, Submit, Cancel), and McpElicitationPrimitive (Root, Message, Fields, Items, Accept, Decline, Cancel, Error) for server-initiated input requests. Covers auth modes none/bearer/oauth, the OAuth flow with McpOAuthCallback and useMcpOAuthCallback, connection states, storage via McpLocalStorage/McpMemoryStorage/McpCustomStorage, reading state with useAuiState (s.mcp, s.mcpServer) and useMcpElicitation/useMcpElicitationField/useMcpServerTool, and imperative addCustomServer/connect/callTool. Distinct from developer-defined backend @ai-sdk/mcp tools in the tools skill. Reach for this when connected-server tools are missing, OAuth never completes, an elicitation prompt does not render, or servers do not persist."
license: MIT
---

# assistant-ui React MCP

**Always consult [assistant-ui.com/llms.txt](https://www.assistant-ui.com/llms.txt) for the latest API.**

Let end users add, authenticate, and manage MCP servers from the browser with `@assistant-ui/react-mcp`. The connected servers' tools are merged into the chat runtime automatically.

## Contents

- [References](#references) | [Routes vs tools](#routes-vs-tools) | [Mount the manager](#mount-the-manager) | [Drop-in dialog](#drop-in-dialog) | [Compose from primitives](#compose-from-primitives) | [OAuth connect flow](#oauth-connect-flow) | [Custom storage](#custom-storage) | [Elicitation](#elicitation) | [Imperative API](#imperative-api) | [Common Gotchas](#common-gotchas) | [Related Skills](#related-skills)

## References

- [./references/setup.md](./references/setup.md) -- McpManagerResource, defineConnector, storage, useAui({ mcp })
- [./references/ui.md](./references/ui.md) -- McpManagerPrimitive / McpServerPrimitive / McpConfigDialog
- [./references/oauth.md](./references/oauth.md) -- OAuth connect flow and auth modes

## Routes vs tools

This skill is for **user-managed** MCP servers: the end user picks and authenticates servers at runtime in the browser. Each server's tools are namespaced as `serverId__toolName` and exposed to the chat runtime with no extra wiring.

For **developer-defined** tools (frontend `makeAssistantTool`, backend AI SDK `tool()`, custom tool-call UI), use the [tools](../tools/SKILL.md) skill instead. The two compose: a chat built with `useChatRuntime` can use both app tools and user-connected MCP tools at once.

## Mount the manager

`McpManagerResource({ connectors })` builds the `mcp` scope; pass it to `useAui` and wrap the app in `AuiProvider`. Connectors are presets declared with `defineConnector`.

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
    icon: "/icons/linear.svg",
  }),
  defineConnector({
    id: "weather",
    name: "Weather",
    url: "https://mcp.example.com/weather",
    auth: { type: "none" },
  }),
];

export function Providers({ children }: { children: React.ReactNode }) {
  const aui = useAui({ mcp: McpManagerResource({ connectors }) });
  return <AuiProvider value={aui}>{children}</AuiProvider>;
}
```

Defaults: `storage` is `McpLocalStorage()`, `oauthRedirectUri` is `${window.location.origin}/mcp/callback`, and `autoConnect` is `true`.

## Drop-in dialog

`McpConfigDialog` is the shadcn dialog that lists connectors and custom servers with inline auth controls and an add form. Drop it anywhere under the provider.

```tsx
import { McpConfigDialog } from "@/components/assistant-ui/mcp-config";

export default function Page() {
  return (
    <header className="flex items-center justify-between">
      <h1>My app</h1>
      <McpConfigDialog />
    </header>
  );
}
```

Pass `children` to override the default trigger: `<McpConfigDialog><Button>Servers</Button></McpConfigDialog>`.

## Compose from primitives

`McpManagerPrimitive` iterates servers; nested `McpServerPrimitive.*` reads each item's scope automatically. Conditional buttons render only when the connection state matches.

```tsx
"use client";
import { McpManagerPrimitive, McpServerPrimitive } from "@assistant-ui/react-mcp";

const ServerCard = () => (
  <McpServerPrimitive.Root>
    <McpServerPrimitive.Icon />
    <McpServerPrimitive.Name />
    <McpServerPrimitive.Status />
    <McpServerPrimitive.ConnectButton>Connect</McpServerPrimitive.ConnectButton>
    <McpServerPrimitive.DisconnectButton>Disconnect</McpServerPrimitive.DisconnectButton>
    <McpServerPrimitive.OAuthLink>Authorize</McpServerPrimitive.OAuthLink>
    <McpServerPrimitive.RemoveButton>Remove</McpServerPrimitive.RemoveButton>
    <McpServerPrimitive.Error />
  </McpServerPrimitive.Root>
);

export default function McpPage() {
  return (
    <McpManagerPrimitive.Root>
      <h2>Connectors</h2>
      <McpManagerPrimitive.Connectors>{() => <ServerCard />}</McpManagerPrimitive.Connectors>
      <h2>Your servers</h2>
      <McpManagerPrimitive.CustomServers>{() => <ServerCard />}</McpManagerPrimitive.CustomServers>
      <McpManagerPrimitive.AddCustomTrigger>Add custom server</McpManagerPrimitive.AddCustomTrigger>
    </McpManagerPrimitive.Root>
  );
}
```

`RemoveButton` is hidden on connectors (presets cannot be removed). Omit `AddCustomTrigger` and `CustomServers` to disable user-added servers. Build the add form with `McpAddFormPrimitive` (`Root`, `NameField`, `UrlField`, `AuthSelect`, `AuthFields`, `Error`, `Submit`, `Cancel`); see [ui.md](./references/ui.md).

## OAuth connect flow

`auth` is one of `{ type: "none" }`, `{ type: "bearer", token? }`, or `{ type: "oauth", scopes?, ... }`. For OAuth, add a callback route at the configured `oauthRedirectUri` and render `McpOAuthCallback` inside the same provider so it can finish the handshake.

```tsx
"use client";
import { McpOAuthCallback } from "@assistant-ui/react-mcp";
import { useRouter } from "next/navigation";
import { Providers } from "../../providers";

export default function Callback() {
  const router = useRouter();
  return (
    <Providers>
      <McpOAuthCallback onComplete={() => router.replace("/mcp")} />
    </Providers>
  );
}
```

See [oauth.md](./references/oauth.md) for the full auth-mode shapes and connection-state values (`connected`, `connecting`, `authRequired`, `authPending`, `error`, `disconnected`).

## Custom storage

Replace the default `McpLocalStorage()` to persist custom servers and auth state on a backend (use `McpMemoryStorage()` for SSR/tests).

```ts
import { McpManagerResource, McpCustomStorage } from "@assistant-ui/react-mcp";

const aui = useAui({
  mcp: McpManagerResource({
    connectors,
    storage: McpCustomStorage({
      loadCustomServers: async () => fetch("/api/mcp/servers").then((r) => r.json()),
      saveCustomServers: async (records) =>
        fetch("/api/mcp/servers", { method: "PUT", body: JSON.stringify(records) }),
      loadAuthState: async (id) =>
        fetch(`/api/mcp/auth/${id}`).then((r) => (r.ok ? r.json() : null)),
      saveAuthState: async (id, state) =>
        fetch(`/api/mcp/auth/${id}`, { method: "PUT", body: JSON.stringify(state) }),
      clearAuthState: async (id) => fetch(`/api/mcp/auth/${id}`, { method: "DELETE" }),
    }),
  }),
});
```

## Elicitation

A connected server can ask the user for structured input mid-run. Render the request with `McpElicitationPrimitive`; the parts read the active request and its JSON Schema, so no manual form wiring is needed.

```tsx
import { McpElicitationPrimitive } from "@assistant-ui/react-mcp";

<McpElicitationPrimitive.Root>
  <McpElicitationPrimitive.Message />
  <McpElicitationPrimitive.Fields>
    <McpElicitationPrimitive.Items />
  </McpElicitationPrimitive.Fields>
  <McpElicitationPrimitive.Error />
  <McpElicitationPrimitive.Accept>Submit</McpElicitationPrimitive.Accept>
  <McpElicitationPrimitive.Decline>Decline</McpElicitationPrimitive.Decline>
  <McpElicitationPrimitive.Cancel>Cancel</McpElicitationPrimitive.Cancel>
</McpElicitationPrimitive.Root>;
```

`useMcpElicitation()` returns the active `MCPElicitation` (`id`, `message`, `requestedSchema`, and a validation `error` when the server rejects a submission). Inside a field, `useMcpElicitationField()` gives `{ name, schema, value, setValue }` for a fully custom input. Drafts are seeded from the schema's defaults.

The three responses are distinct: `accept` sends `content`, `decline` refuses this request, `cancel` dismisses it without answering.

## Imperative API

Inside event handlers, drive the manager through `useAui().mcp`.

```ts
const aui = useAui();
await aui.mcp.addCustomServer({ name, url, auth: { type: "bearer", token } });
await aui.mcp.server({ id }).connect();
await aui.mcp.server({ id }).callTool("echo", { text: "hi" });
```

Read reactive state with `useAuiState`, scoped under `s.mcp` (manager) and `s.mcpServer` (current item inside a `McpServerPrimitive` subtree):

```ts
const isHydrated = useAuiState((s) => s.mcp.isHydrated);
const connectionState = useAuiState((s) => s.mcpServer.connectionState);
```

## Common Gotchas

**Tools not appearing in chat**
- The server must reach the `connected` state; check `McpServerPrimitive.Status` or `s.mcpServer.connectionState`.
- Tool names are prefixed `serverId__toolName`; reference that exact name in tool UI.

**OAuth never completes**
- The callback route path must match `oauthRedirectUri` (default `/mcp/callback`).
- `McpOAuthCallback` must be rendered inside the same provider as the manager.

**Servers not persisting / SSR errors**
- Default `McpLocalStorage()` needs the browser; use `McpMemoryStorage()` or `McpCustomStorage(...)` on the server.

**Custom server cannot be removed**
- `RemoveButton` hides on connector presets by design; only user-added servers are removable.

**Elicitation prompt never renders**
- `McpElicitationPrimitive.Root` renders nothing when there is no active request; mount it inside the same provider as the manager and check `useMcpElicitation()`.

**Transport**
- Only StreamableHTTP is supported. `listResources()` supports pagination; prompts, sampling, and auto-reconnect are not yet wired.

## Related Skills

- [tools](../tools/SKILL.md) -- developer-defined frontend/backend tools and custom tool-call UI (`makeAssistantTool`, AI SDK `tool()`, `makeAssistantToolUI`); the complement to user-managed MCP servers.
- [setup](../setup/SKILL.md) -- scaffold with the `mcp` template (`npx assistant-ui@latest create -t mcp`) and pick a runtime.
- [runtime](../runtime/SKILL.md) -- the chat runtime (`useChatRuntime`) that MCP tools are merged into.
