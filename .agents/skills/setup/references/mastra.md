# Mastra Integration

Wire Mastra agents into assistant-ui. There is no `@assistant-ui/react-mastra` package; use `useChatRuntime` from `@assistant-ui/react-ai-sdk` against a route that wraps `agent.stream()`.

## Contents

- [Two Deployment Modes](#two-deployment-modes)
- [Full-Stack (agent in a Next.js route)](#full-stack-agent-in-a-nextjs-route)
- [Separate Server (@mastra/ai-sdk chatRoute)](#separate-server-mastraai-sdk-chatroute)
- [Frontend (shared)](#frontend-shared)
- [Notes](#notes)
- [Troubleshooting](#troubleshooting)

## Two Deployment Modes

| Mode | Where the agent runs | Backend wiring | Frontend transport |
|------|----------------------|----------------|--------------------|
| Full-stack | Next.js API route in the same app | `agent.stream()` + `toAISdkStream` + `createUIMessageStream` | default (`AssistantChatTransport` to `/api/chat`) |
| Separate server | Standalone Mastra server | `chatRoute({ path })` from `@mastra/ai-sdk` | `AssistantChatTransport` pointed at the Mastra URL |

Both modes use `useChatRuntime` from `@assistant-ui/react-ai-sdk`. Mastra never exposes a dedicated assistant-ui package; the integration rides the AI SDK runtime. Do not reach for `@mastra/client-js` for the chat stream; the browser talks to the Mastra HTTP route directly through `AssistantChatTransport`.

## Full-Stack (agent in a Next.js route)

Install `@mastra/core`, `@mastra/ai-sdk`, and `zod` alongside the assistant-ui packages (`npx assistant-ui@latest init` brings in `ai`).

```bash
npm install @mastra/core @mastra/ai-sdk zod
```

Mark Mastra as a server external package so its native deps are not bundled:

```js
// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@mastra/*"],
};
export default nextConfig;
```

Define the agent:

```ts
// mastra/agents/chefAgent.ts
import { Agent } from "@mastra/core/agent";

export const chefAgent = new Agent({
  name: "chef-agent",
  instructions:
    "You are Michel, a practical and experienced home chef. " +
    "You help people cook with whatever ingredients they have available.",
  model: "openai/gpt-5.4-mini",
});
```

Register it on a `Mastra` instance:

```ts
// mastra/index.ts
import { Mastra } from "@mastra/core";
import { chefAgent } from "./agents/chefAgent";

export const mastra = new Mastra({
  agents: { chefAgent },
});
```

The route resolves the agent, calls `agent.stream(messages)`, then adapts the Mastra stream into AI SDK UI message parts with `toAISdkStream` and returns them via `createUIMessageStreamResponse`:

```ts
// app/api/chat/route.ts
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { toAISdkStream } from "@mastra/ai-sdk";
import { mastra } from "@/mastra";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();
  const agent = mastra.getAgent("chefAgent");
  const stream = await agent.stream(messages);

  const uiMessageStream = createUIMessageStream({
    originalMessages: messages,
    execute: async ({ writer }) => {
      for await (const part of toAISdkStream(stream, { from: "agent" })) {
        await writer.write(part);
      }
    },
  });

  return createUIMessageStreamResponse({ stream: uiMessageStream });
}
```

`mastra.getAgent("chefAgent")` keys off the property name in the `agents` object, not the agent's `name` field. Set `OPENAI_API_KEY` (or the relevant provider key) in `.env.local`.

## Separate Server (@mastra/ai-sdk chatRoute)

Run Mastra standalone (for example via `npx create-mastra@latest`) and add the AI SDK adapter:

```bash
npm install @mastra/ai-sdk
```

`chatRoute` from `@mastra/ai-sdk` registers an HTTP endpoint that already emits an AI SDK UI message stream, so no manual `agent.stream()` plumbing is needed. The `:agentId` segment matches the key in the `agents` object:

```ts
// src/mastra/index.ts
import { Mastra } from "@mastra/core";
import { chatRoute } from "@mastra/ai-sdk";
import { chefAgent } from "./agents/chefAgent";

export const mastra = new Mastra({
  agents: { chefAgent },
  server: {
    cors: {
      origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
      credentials: true,
    },
    apiRoutes: [chatRoute({ path: "/chat/:agentId" })],
  },
});
```

The agent definition is identical to the full-stack one. With the Mastra server on its default port, `chefAgent` is reachable at `http://localhost:4111/chat/chefAgent` (the property key is camelCase, not the kebab-case `name`). Delete the scaffolded `app/api/chat/route.ts` in the frontend; the agent lives on the Mastra server now.

CORS must allow the frontend origin. Without it the browser blocks the request and the chat silently fails.

## Frontend (shared)

Full-stack apps use the default transport (the route is local at `/api/chat`):

```tsx
// app/assistant.tsx
"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/assistant-ui/thread";

export const Assistant = () => {
  const runtime = useChatRuntime();

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
};
```

Separate-server apps point `AssistantChatTransport` at the Mastra URL:

```tsx
// app/assistant.tsx
"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/assistant-ui/thread";

export const Assistant = () => {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: process.env.NEXT_PUBLIC_MASTRA_URL!,
    }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
};
```

```
# .env.local (frontend)
NEXT_PUBLIC_MASTRA_URL=http://localhost:4111/chat/chefAgent
```

For auth, `AssistantChatTransport` accepts `headers` and `credentials` options; combine `credentials: "include"` with the server's `cors.credentials: true`.

## Notes

- No `@assistant-ui/react-mastra` exists. Anything claiming such an import is wrong.
- `toAISdkStream(stream, { from: "agent" })` adapts the Mastra-native stream from `agent.stream()` into AI SDK parts; `from: "agent"` tags the source.
- Mastra runs its own server with `.env.development`; the assistant-ui frontend uses `.env.local`. Keep them separate.
- Because the integration is the AI SDK runtime, the AI SDK reference (frontend tool forwarding, attachments, cloud persistence) applies unchanged. See the AI SDK reference.

## Troubleshooting

**Module not found: @assistant-ui/react-mastra**
That package does not exist. Use `useChatRuntime` from `@assistant-ui/react-ai-sdk` against a Mastra route.

**Chat silently fails in separate-server mode**
Missing CORS on the Mastra server. Configure `server.cors.origin` to the frontend origin (and `credentials: true` if sending cookies).

**404 from the Mastra route**
The `:agentId` path segment must match the key in the `agents` object (camelCase property name), not the agent's `name` field. `agents: { chefAgent }` serves `/chat/chefAgent`.

**Native module bundling errors in Next.js**
Add `serverExternalPackages: ["@mastra/*"]` to `next.config.mjs`.

**Stream renders nothing in full-stack mode**
Wrap `agent.stream()` output with `toAISdkStream(...)` and write each part into `createUIMessageStream`; return it via `createUIMessageStreamResponse`. Returning the raw Mastra stream will not parse.
