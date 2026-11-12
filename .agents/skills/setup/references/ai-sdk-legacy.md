# AI SDK Legacy (v6, v5, and v4)

Keep an app on a legacy AI SDK release instead of migrating to v7. Each older AI SDK major needs a pinned adapter release, because `@assistant-ui/react-ai-sdk@latest` (1.4.x) depends on `ai@^7`. For new projects, see `ai-sdk.md` instead.

| AI SDK | Adapter package to install | Runtime hook |
|---|---|---|
| `ai@^7` + `@ai-sdk/react@^4` | `@assistant-ui/react-ai-sdk@latest` | `useChatRuntime` |
| `ai@^6` + `@ai-sdk/react@^3` | `@assistant-ui/react-ai-sdk@1.3.40` | `useChatRuntime` |
| `ai@^5` + `@ai-sdk/react@^2` | `@assistant-ui/react-ai-sdk@1.1.21` | `useChatRuntime` |
| `ai@^4` | `@assistant-ui/react-data-stream` | `useDataStreamRuntime` |

These pins receive no new features and have known compatibility gaps against current `@assistant-ui/react`.

## Contents

- [AI SDK v6 (legacy)](#ai-sdk-v6-legacy)
- [AI SDK v5 (legacy)](#ai-sdk-v5-legacy)
- [AI SDK v4 (legacy)](#ai-sdk-v4-legacy)
  - [Install](#install-1)
  - [Backend route](#backend-route-1)
  - [Frontend with useDataStreamRuntime](#frontend-with-usedatastreamruntime)
  - [useDataStreamRuntime options](#usedatastreamruntime-options)
- [Why these are legacy](#why-these-are-legacy)

## AI SDK v6 (legacy)

Pin `@assistant-ui/react-ai-sdk@1.3.40` with `ai@^6` and `@ai-sdk/react@^3`.

```bash
npm install @assistant-ui/react @assistant-ui/react-ai-sdk@1.3.40 ai@^6 @ai-sdk/react@^3 @ai-sdk/openai@^3 zod
```

The wiring is the same as v7 except the route response:

```ts
import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, type UIMessage } from "ai";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openai("gpt-5.4-nano"),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
```

In v7 that method is deprecated in favor of `createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) })`.

## AI SDK v5 (legacy)

Pin `@assistant-ui/react-ai-sdk@1.1.21` with `ai@^5`. Tools use `parameters:` (not `inputSchema:`), and the route returns `toDataStreamResponse()`.

### Install

```bash
npm install @assistant-ui/react @assistant-ui/react-ai-sdk@1.1.21 ai@^5 @ai-sdk/react@^2 @ai-sdk/openai@^1 zod
```

### Backend route

```ts
// app/api/chat/route.ts
import { openai } from "@ai-sdk/openai";
import { streamText, tool } from "ai";
import type { Message } from "ai";
import { z } from "zod";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: Message[] } = await req.json();

  const result = streamText({
    model: openai("gpt-5.4-nano"),
    messages,
    tools: {
      get_current_weather: tool({
        description: "Get the current weather",
        parameters: z.object({ city: z.string() }),
        execute: async ({ city }) => `The weather in ${city} is sunny`,
      }),
    },
  });

  return result.toDataStreamResponse();
}
```

Note: in v5 `streamText` takes `messages` directly (no `convertToModelMessages`), tools use `parameters:`, and the response is `toDataStreamResponse()`.

### Frontend

`@assistant-ui/react-ai-sdk@1.1.21` exposes `useChatRuntime` and `useAISDKRuntime`. Prefer `useChatRuntime`; reach for `useAISDKRuntime` when you need to own the `useChat` instance.

```tsx
"use client";

import { useChat } from "@ai-sdk/react";
import { useAISDKRuntime } from "@assistant-ui/react-ai-sdk";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";

export default function Home() {
  const chat = useChat({ api: "/api/chat" });
  const runtime = useAISDKRuntime(chat);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="h-dvh">
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  );
}
```

`useVercelUseChatRuntime` was the pre-0.11.3 name for this wiring and no longer exists on any current release line.

## AI SDK v4 (legacy)

`@assistant-ui/react-ai-sdk` targets `ai@^6` and up, so v4 apps integrate through `@assistant-ui/react-data-stream`, which speaks the same data stream protocol that v4's `toDataStreamResponse()` emits.

### Install

```bash
npm install @assistant-ui/react @assistant-ui/react-data-stream ai@^4 @ai-sdk/openai
```

### Backend route

```ts
// app/api/chat/route.ts
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = streamText({ model: openai("gpt-5.4-nano"), messages });
  return result.toDataStreamResponse();
}
```

### Frontend with useDataStreamRuntime

`useDataStreamRuntime` comes from `@assistant-ui/react-data-stream`. Set `protocol: "data-stream"` so it parses v4's `toDataStreamResponse()` output; the default protocol expects the SSE format used by newer AI SDK releases.

```tsx
"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useDataStreamRuntime } from "@assistant-ui/react-data-stream";
import { Thread } from "@/components/assistant-ui/thread";

export default function Home() {
  const runtime = useDataStreamRuntime({
    api: "/api/chat",
    protocol: "data-stream",
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="h-full">
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  );
}
```

### useDataStreamRuntime options

- `api`: endpoint URL for the data stream protocol.
- `protocol`: `"data-stream"` to pair with v4's `toDataStreamResponse()`.
- `headers`: `Record<string, string>`, `Headers`, or an async function returning headers.
- `body`: object or async function returning extra request body params.
- Lifecycle callbacks: `onResponse`, `onFinish`, `onError`, `onCancel`.

Note: human in the loop tools (`human()` interrupts) are not supported by the data stream runtime; use `LocalRuntime` directly if you need approval flows.

## Why these are legacy

Each AI SDK major introduced breaking API changes, and `@assistant-ui/react-ai-sdk` tracks the newest one. Differences that show up when a legacy stack is upgraded:

| Area | v4 | v5 | v6 | v7 (current) |
|---|---|---|---|---|
| `ai` package | `ai@^4` | `ai@^5` | `ai@^6` | `ai@^7` |
| `@ai-sdk/react` | `ai/react` | `^2` | `^3` | `^4` |
| `@ai-sdk/openai` | any | `^1` | `^3` | `^4` |
| Adapter package | `@assistant-ui/react-data-stream` | `@assistant-ui/react-ai-sdk@1.1.21` | `@assistant-ui/react-ai-sdk@1.3.40` | `@assistant-ui/react-ai-sdk@latest` |
| Runtime hook | `useDataStreamRuntime` | `useChatRuntime` | `useChatRuntime` | `useChatRuntime` |
| `convertToModelMessages` | not used | sync | async (`await`) | async (`await`) |
| Tool schema key | n/a | `parameters:` | `inputSchema:` | `inputSchema: zodSchema(...)` |
| Response | `toDataStreamResponse()` | `toDataStreamResponse()` | `toUIMessageStreamResponse()` | `createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) })` |

To move off legacy, switch the runtime hook to `useChatRuntime`, update the backend to v7 `streamText`, and apply the AI SDK codemods at `ai-sdk.dev/docs/migration-guides`.
