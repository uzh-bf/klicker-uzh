# Cloudflare Agents Integration

Wire Cloudflare's stateful agent framework into assistant-ui via the AI SDK runtime: `useAgent` -> `useAgentChat` -> `useAISDKRuntime` -> `AssistantRuntimeProvider`.

## Contents

- [Architecture](#architecture)
- [Packages](#packages)
- [Server: define the agent](#server-define-the-agent)
- [Server: route requests](#server-route-requests)
- [Server: wrangler config](#server-wrangler-config)
- [Server: run locally](#server-run-locally)
- [Client: wire the runtime](#client-wire-the-runtime)
- [Client: environment](#client-environment)
- [Type compatibility with useChat](#type-compatibility-with-usechat)
- [Cloudflare-specific extras](#cloudflare-specific-extras)
- [setMessages round-trips through the Durable Object](#setmessages-round-trips-through-the-durable-object)
- [Authentication](#authentication)
- [Version stability](#version-stability)

## Architecture

This is an integration guide, not a runtime adapter. assistant-ui ships no `@assistant-ui/react-cloudflare-agents` package. The two halves:

- Server: a Durable Object subclasses `AIChatAgent` from `@cloudflare/ai-chat`, owns the SQLite-backed message history, and streams responses over a WebSocket.
- Client: `@cloudflare/ai-chat/react`'s `useAgentChat` wraps that WebSocket and exposes the same `messages`, `sendMessage`, `regenerate`, `status`, `stop`, `setMessages`, `addToolOutput` surface as the AI SDK's `useChat`. `useAISDKRuntime` from `@assistant-ui/react-ai-sdk` reads those methods off whatever you pass it, so feeding it `useAgentChat`'s return value yields a full runtime: streaming, tool calling, edit, reload, history import and export.

Note: `AssistantCloud` integrates via `useChatRuntime` (which builds its own `useChat`) and is not compatible with the `useAgentChat` wiring shown here. Multi-thread support needs a custom thread list wired around `useAISDKRuntime`.

## Packages

Worker side:

```sh
npm install agents@0.12.4 @cloudflare/ai-chat@0.7.0 ai@latest @ai-sdk/openai@latest
```

Frontend side (in addition to `@assistant-ui/react` and `@assistant-ui/react-ai-sdk` from `npx assistant-ui@latest create`):

```sh
npm install agents@0.12.4 @cloudflare/ai-chat@0.7.0
```

Pin `agents` and `@cloudflare/ai-chat` to exact versions; both are pre-1.0 and ship breaking changes between minor releases.

## Server: define the agent

`AIChatAgent` already implements message persistence, the streaming protocol, and WebSocket plumbing. Override `onChatMessage` to plug in your model and tools. `this.messages` is the persisted history for this Durable Object instance.

```ts title="src/chat.ts"
import { AIChatAgent } from "@cloudflare/ai-chat";
import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";

export type Env = {
  OPENAI_API_KEY: string;
  Chat: DurableObjectNamespace<Chat>;
};

export class Chat extends AIChatAgent<Env> {
  async onChatMessage(onFinish: Parameters<typeof streamText>[0]["onFinish"]) {
    return streamText({
      model: openai("gpt-4o-mini"),
      messages: await convertToModelMessages(this.messages),
      onFinish,
    });
  }
}
```

The `Chat: DurableObjectNamespace<Chat>` field mirrors the binding declared in `wrangler.jsonc` and is what `routeAgentRequest` looks up to resolve the agent. Each unique agent `name` you connect with from the client gets its own instance and its own message log.

## Server: route requests

`routeAgentRequest` handles WebSocket upgrades, agent lookup by URL path, and the `/get-messages` HTTP endpoint the frontend uses for history rehydration. The `cors` helper reflects the request origin so the frontend can talk to the Worker across ports during local development; WebSocket upgrades bypass CORS in the browser, but the `/get-messages` fetch needs these headers.

```ts title="src/index.ts"
import { routeAgentRequest } from "agents";
import { Chat, type Env } from "./chat";

export { Chat };

const cors = (request: Request) => ({
  "Access-Control-Allow-Origin": request.headers.get("Origin") ?? "*",
  "Access-Control-Allow-Headers": "Content-Type, Upgrade",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
});

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors(request) });
    }
    const upstream =
      (await routeAgentRequest(request, env)) ??
      new Response("Not found", { status: 404 });
    const res = new Response(upstream.body, upstream);
    for (const [k, v] of Object.entries(cors(request))) res.headers.set(k, v);
    return res;
  },
} satisfies ExportedHandler<Env>;
```

For production, replace the wildcard origin fallback with an explicit allowlist.

## Server: wrangler config

The binding `name` and `class_name` must match the exported class. `new_sqlite_classes` is required so the Durable Object can use SQLite for message storage.

```jsonc title="wrangler.jsonc"
{
  "name": "my-agent",
  "main": "src/index.ts",
  "compatibility_date": "2026-01-01",
  "compatibility_flags": ["nodejs_compat"],
  "durable_objects": {
    "bindings": [{ "name": "Chat", "class_name": "Chat" }]
  },
  "migrations": [
    { "tag": "v1", "new_sqlite_classes": ["Chat"] }
  ]
}
```

## Server: run locally

Local `wrangler dev` reads environment variables from `.dev.vars`, not the remote secret store:

```sh title=".dev.vars"
OPENAI_API_KEY=sk-...
```

```sh
wrangler dev
```

The Worker boots on `http://localhost:8787`. For production, upload the same key as a deployed Worker secret before `wrangler deploy`:

```sh
wrangler secret put OPENAI_API_KEY
```

## Client: wire the runtime

The full chain: `useAgent` -> `useAgentChat` -> `useAISDKRuntime` -> `AssistantRuntimeProvider`.

```tsx title="app/assistant.tsx"
"use client";

import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useAISDKRuntime } from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/assistant-ui/thread";

export const Assistant = () => {
  const agent = useAgent({
    agent: "Chat",
    name: "default",
    host: process.env.NEXT_PUBLIC_AGENT_HOST!,
  });
  const chat = useAgentChat({ agent });
  const runtime = useAISDKRuntime(chat);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
};
```

`agent` is the Durable Object class name. `name: "default"` is the instance key; pass a per-user value (a user ID, session ID, or chat ID) to give each user their own persisted history. Switching `name` opens a new WebSocket to a different Durable Object instance. `host` is the Worker base URL.

## Client: environment

```sh title=".env.local"
NEXT_PUBLIC_AGENT_HOST=http://localhost:8787
```

`NEXT_PUBLIC_*` exposes the value to the browser. In production, point it at your deployed Worker (e.g. `https://my-agent.example.workers.dev`).

## Type compatibility with useChat

`useAgentChat`'s return type is `Omit<ReturnType<typeof useChat>, "addToolOutput"> & { ... }`. The `addToolOutput` option shape differs slightly: `useChat` accepts `{ state, tool, toolCallId, ... }`; `useAgentChat` accepts `{ state, toolCallId, toolName?, ... }`. At runtime the paths converge through `useAISDKRuntime` without issue. If the compiler flags the call, cast at the call site:

```tsx
const runtime = useAISDKRuntime(
  chat as Parameters<typeof useAISDKRuntime>[0],
);
```

If TypeScript still refuses the direct cast, use `chat as unknown as Parameters<typeof useAISDKRuntime>[0]`. Note: `satisfies` does not help; it validates assignability without changing the inferred type, so it surfaces the same error.

## Cloudflare-specific extras

`useAgentChat` exposes three values that `useChat` does not. Destructure them alongside `chat` and pass them into your UI directly; they don't need to flow through the runtime.

- `clearHistory()` sends a `cf_agent_chat_clear` frame and wipes the Durable Object's SQLite store. `setMessages([])` alone only clears the client view.
- `isServerStreaming` is `true` while the server is pushing tokens, independent of client-initiated request state. Use it for a universal streaming indicator.
- `isToolContinuation` distinguishes "server auto-continuing after a tool result" from "user just sent a new message"; useful for typing-indicator gating.

## setMessages round-trips through the Durable Object

`useAgentChat` overrides `setMessages` to broadcast the new list over the WebSocket so the Durable Object's SQLite history stays in sync. This means assistant-ui's `onImport`, `onEdit`, `onReload`, and pending-tool cancellation paths all persist server-side automatically. The tradeoff is one extra WebSocket round-trip per mutation, which can race if the connection lags; assume eventual consistency, not transactional.

## Authentication

`routeAgentRequest` accepts any client that knows the agent class and `name`. If you derive `name` from a user ID, any client that knows or guesses another user's ID can connect to that Durable Object and read its full message log. Before deploying:

- Gate the fetch handler with a header or cookie check (e.g. a JWT issued by your auth backend), and only call `routeAgentRequest` after the request is authenticated.
- Pass the same credential from the frontend via `useAgent`'s `headers` or `query` options so the WebSocket upgrade carries it.
- Tighten the CORS `Access-Control-Allow-Origin` to an explicit allowlist.

## Version stability

`agents` and `@cloudflare/ai-chat` are pre-1.0 and ship breaking changes between minor versions. Pin both to exact versions in `package.json` and read the Cloudflare changelog before bumping. The `useAgentChat` return shape has been additive since 0.3.0, so this integration should keep working across patch releases.
