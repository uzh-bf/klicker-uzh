# MCP OAuth and Auth Modes

Let end users connect and authenticate MCP servers from the browser with `@assistant-ui/react-mcp`. Auth modes are `none`, `bearer`, and `oauth` (PKCE + DCR).

## Contents

- [Auth modes](#auth-modes)
- [Connectors and the manager resource](#connectors-and-the-manager-resource)
- [OAuth connect flow](#oauth-connect-flow)
- [OAuth callback route](#oauth-callback-route)
- [Server connect UI](#server-connect-ui)
- [Imperative connect and auth](#imperative-connect-and-auth)
- [Reading connection state](#reading-connection-state)
- [Token storage](#token-storage)

## Auth modes

Each connector or custom server carries an `auth` config. Three shapes:

```ts
// no auth header
{ type: "none" }

// Authorization: Bearer …
{ type: "bearer", token: "…" }

// PKCE + DCR + refresh; every field below the type is optional
{
  type: "oauth",
  scopes: ["read"],
  authorizationEndpoint: "…", // overrides RFC 8414 discovery
  tokenEndpoint: "…",
  registrationEndpoint: "…",
  clientId: "…",              // skip DCR with a static client
  clientSecret: "…",
}
```

With `oauth` and no endpoint overrides, the client discovers metadata (RFC 8414), dynamically registers (DCR, RFC 7591), runs PKCE, exchanges the code, and refreshes tokens on 401. Set `clientId` (and `clientSecret`) to skip DCR with a pre-registered client.

## Connectors and the manager resource

OAuth connectors are declared with `defineConnector({ ..., auth: { type: "oauth", scopes } })` and mounted via `McpManagerResource` on the `aui` instance. The `oauthRedirectUri` option defaults to `"${window.location.origin}/mcp/callback"`. See [./setup.md](./setup.md) for the full `defineConnector` / `McpManagerResource` / provider setup.

## OAuth connect flow

1. The user triggers a connect on an `oauth` server (button or imperative call).
2. The client runs discovery/DCR/PKCE and opens the authorization URL.
3. The provider redirects back to `oauthRedirectUri` with `?state=…&code=…`. The server id is encoded in the OAuth `state` param, so one callback route resolves any server.
4. The callback route completes the exchange; `autoConnect` then connects the server.

Set the redirect URI explicitly when not using the default route:

```ts
McpManagerResource({
  connectors,
  oauthRedirectUri: `${window.location.origin}/auth/mcp`,
});
```

## OAuth callback route

Render `McpOAuthCallback` at the redirect path. It reads `code` and `state` from the URL and calls `completeAuth` on the right server. Wrap it in the same `Providers` so the manager resource is in scope.

```tsx
// app/mcp/callback/page.tsx
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

`McpOAuthCallback` takes `onComplete: () => void`, fired after the token exchange resolves.

## Server connect UI

`McpServerPrimitive` action buttons render only when the server's state matches, so no manual gating is needed: `ConnectButton` when connectable, `OAuthLink` when authorization is required, `DisconnectButton` when connected.

```tsx
"use client";
import {
  McpManagerPrimitive,
  McpServerPrimitive,
} from "@assistant-ui/react-mcp";

const ServerCard = () => (
  <McpServerPrimitive.Root>
    <McpServerPrimitive.Icon />
    <McpServerPrimitive.Name />
    <McpServerPrimitive.Status />
    <McpServerPrimitive.ConnectButton>Connect</McpServerPrimitive.ConnectButton>
    <McpServerPrimitive.DisconnectButton>Disconnect</McpServerPrimitive.DisconnectButton>
    <McpServerPrimitive.OAuthLink>Authorize ↗</McpServerPrimitive.OAuthLink>
    <McpServerPrimitive.RemoveButton>Remove</McpServerPrimitive.RemoveButton>
    <McpServerPrimitive.Error />
  </McpServerPrimitive.Root>
);

export default function McpPage() {
  return (
    <McpManagerPrimitive.Root>
      <h2>Connectors</h2>
      <McpManagerPrimitive.Connectors>
        {() => <ServerCard />}
      </McpManagerPrimitive.Connectors>
      <h2>Your servers</h2>
      <McpManagerPrimitive.CustomServers>
        {() => <ServerCard />}
      </McpManagerPrimitive.CustomServers>
      <McpManagerPrimitive.AddCustomTrigger>
        Add custom server
      </McpManagerPrimitive.AddCustomTrigger>
    </McpManagerPrimitive.Root>
  );
}
```

## Imperative connect and auth

`aui.mcp.server({ id }).connect()`, called from an event handler, triggers the OAuth flow when the server needs it. See [./setup.md](./setup.md) for the full imperative API (`addCustomServer`, `connect`, `callTool`).

## Reading connection state

Read state with `useAuiState` from `@assistant-ui/store`. The `mcpServer.*` selectors require an `McpServerByIdProvider` in scope, which the manager iteration primitives supply automatically.

```ts
import { useAuiState } from "@assistant-ui/store";

const isHydrated = useAuiState((s) => s.mcp.isHydrated);
const connectionState = useAuiState((s) => s.mcpServer.connectionState);
const name = useAuiState((s) => s.mcpServer.name);
const icon = useAuiState((s) => s.mcpServer.icon ?? null);
const error = useAuiState((s) => s.mcpServer.lastError?.message ?? null);
```

## Token storage

OAuth tokens persist through the manager's `storage`. `McpLocalStorage` (the default) keeps them in plain text and is XSS-exposed; for anything beyond local prototyping use `McpCustomStorage` against an HTTP-only-cookie-backed endpoint. See [./setup.md](./setup.md) for the storage backends and a full `McpCustomStorage` example.
