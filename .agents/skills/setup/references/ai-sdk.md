# AI SDK v7 Integration

Use this when the app uses `@assistant-ui/react-ai-sdk` and an `/api/chat` route powered by `ai@^7`.

`@assistant-ui/react-ai-sdk` 1.4.x targets AI SDK v7 (`ai@^7`, `@ai-sdk/react@^4`). Projects still on an older AI SDK major must pin an older adapter release; see [ai-sdk-legacy.md](./ai-sdk-legacy.md).

```bash
npm install @assistant-ui/react @assistant-ui/react-ai-sdk ai@^7 @ai-sdk/react@^4 @ai-sdk/openai zod
```

## What Changed in AI SDK v7

Agents trained on older AI SDK versions will use outdated patterns. These are **AI SDK** breaking changes (not assistant-ui changes):

| Concept | Old (v4/v5) | v6 | Current (v7) |
|---------|-------------|----|--------------|
| `ai` package | `ai@^4` / `ai@^5` | `ai@^6` | `ai@^7` |
| `@ai-sdk/react` | `ai/react` / `@ai-sdk/react@^2` | `@ai-sdk/react@^3` | `@ai-sdk/react@^4` |
| assistant-ui wiring | `useAISDKRuntime(chat)` | `useChatRuntime({ transport })` | `useChatRuntime()` |
| Message conversion | Pass messages directly | `await convertToModelMessages(messages)` | `await convertToModelMessages(messages)` |
| Stream response | `result.toDataStreamResponse()` | `result.toUIMessageStreamResponse()` | `createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) })` |
| Tool schema key | `parameters: z.object({...})` | `inputSchema: z.object({...})` | `inputSchema: zodSchema(z.object({...}))` |
| Multi-step tools | `maxSteps: n` | `stopWhen: stepCountIs(n)` | `stopWhen: stepCountIs(n)` |

`result.toUIMessageStreamResponse()` still compiles in v7 but is deprecated and scheduled for removal in the next major; write new routes with the standalone helpers.

## Standard Setup

**Frontend**:

```tsx
"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { Thread } from "@/components/assistant-ui/thread";

export function Assistant() {
  const runtime = useChatRuntime({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="h-dvh">
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  );
}
```

`useChatRuntime()` defaults to `AssistantChatTransport` pointing at `/api/chat`, so the no-argument form is the common case.

**Backend** route (`app/api/chat/route.ts`):

```ts
import { openai } from "@ai-sdk/openai";
import { frontendTools } from "@assistant-ui/react-ai-sdk";
import {
  streamText,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
  type UIMessage,
} from "ai";

export async function POST(req: Request) {
  const {
    messages,
    system,
    tools,
  }: {
    messages: UIMessage[];
    system?: string;
    tools?: Record<string, any>;
  } = await req.json();

  const result = streamText({
    model: openai("gpt-5.4-mini"),
    system,
    messages: await convertToModelMessages(messages),
    tools: {
      ...frontendTools(tools ?? {}),
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
```

`AssistantChatTransport` (the default transport for `useChatRuntime`) automatically forwards `system` and `tools` from the frontend to the backend:

- **`system`**: set via `useAssistantInstructions()` on the frontend, sent as a string in the request body.
- **`tools`**: registered via `makeAssistantTool()` or `useAssistantTool()` on the frontend, sent as JSON Schema definitions in the request body.
- **`frontendTools()`**: converts those JSON Schema definitions into the AI SDK tool format so `streamText` can use them alongside backend-defined tools.

The route must destructure and use both `system` and `tools` for frontend tool forwarding to work.

## Runtime Options

`useChatRuntime` supports the underlying AI SDK chat options plus assistant-ui extensions like `cloud`, `adapters`, `onThreadIdChange`, `joinStrategy`, and `onResume`.

```tsx
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";

const runtime = useChatRuntime({
  transport: new AssistantChatTransport({
    api: "/api/chat",
    headers: { "X-Workspace": "acme" },
    body: { model: "gpt-5.4-mini" },
  }),
  messages: [
    { id: "1", role: "assistant", parts: [{ type: "text", text: "Hello! How can I help?" }] },
  ],
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  onError: (error) => {
    console.error(error);
  },
  cloud, // optional AssistantCloud instance
  adapters: {
    attachments: attachmentAdapter,
    feedback: feedbackAdapter,
  },
});
```

If you explicitly need non-assistant transport behavior, pass a custom transport:

```tsx
import { DefaultChatTransport } from "ai";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";

const runtime = useChatRuntime({
  transport: new DefaultChatTransport({ api: "/api/chat" }),
});
```

## Tools (AI SDK v7 shape)

Use `tool({ inputSchema })` and `stopWhen: stepCountIs(...)` for multi-step tool loops.

`inputSchema` is typed `FlexibleSchema`, which accepts a raw Zod schema, a Standard Schema, or the result of `zodSchema()` / `jsonSchema()`. Passing `z.object({ ... })` directly is valid; `zodSchema(z.object({ ... }))` is the explicit form the upstream quickstart uses. Both work, so pick one and stay consistent within a project.

```ts
import { openai } from "@ai-sdk/openai";
import {
  streamText,
  tool,
  zodSchema,
  stepCountIs,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { z } from "zod";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openai("gpt-5.4-mini"),
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(10),
    tools: {
      get_weather: tool({
        description: "Get weather by city",
        inputSchema: zodSchema(z.object({ city: z.string() })),
        execute: async ({ city }) => ({ city, temperature: 22, unit: "C" }),
      }),
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
```

Without a `stopWhen`, AI SDK runs a single inference step; set `stepCountIs(n)` when tools chain.

## Server-Side Tool Approval

AI SDK v7 gates tool execution either with `needsApproval` on the tool definition or with the call-level `toolApproval` option; both exist and can be used together. The server pauses, emits an `approval-requested` part, and resumes once the client posts a response. assistant-ui surfaces the gate as `approval` on the tool part and passes `respondToApproval` into the renderer.

`toolApproval` is the per-call form, which is what the example below uses because the decision depends on the input:

```ts
const result = streamText({
  model: openai("gpt-5.4-mini"),
  messages: await convertToModelMessages(messages),
  tools: {
    deploy: tool({
      description: "Deploy the current build to an environment.",
      inputSchema: z.object({ target: z.string() }),
      execute: async ({ target }) => ({ deployed: target }),
    }),
  },
  toolApproval: {
    deploy: (input) =>
      input.target === "production" ? "user-approval" : "not-applicable",
  },
});
```

On the client, use `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses` so the decision is posted back automatically. See the `/tools` skill for the renderer side.

## Frontend Tool UI

Use `makeAssistantToolUI` to render tool calls in the chat. Place the component inside `AssistantRuntimeProvider`.

```tsx
import { makeAssistantToolUI } from "@assistant-ui/react";

const WeatherToolUI = makeAssistantToolUI({
  toolName: "get_weather",
  render: ({ args, result, status }) => {
    if (status.type === "running") {
      return <div>Loading weather for {args.city}...</div>;
    }
    return (
      <div className="p-4 rounded bg-blue-50">
        <strong>{result?.city}</strong>: {result?.temperature}°{result?.unit}
      </div>
    );
  },
});

<AssistantRuntimeProvider runtime={runtime}>
  <WeatherToolUI />
  <Thread />
</AssistantRuntimeProvider>
```

## Token Usage

`@assistant-ui/react-ai-sdk` exposes per-thread token accounting:

```tsx
import { useThreadTokenUsage } from "@assistant-ui/react-ai-sdk";

const usage = useThreadTokenUsage(); // ThreadTokenUsage | undefined
```

`getThreadMessageTokenUsage(message)` reads usage off a single message outside React.

## Using Different Providers

Swap the model in `streamText()`; any `@ai-sdk/*` provider works:

```ts
import { anthropic } from "@ai-sdk/anthropic";
streamText({ model: anthropic("claude-sonnet-4-20250514"), ... });

import { google } from "@ai-sdk/google";
streamText({ model: google("gemini-2.0-flash"), ... });

import { bedrock } from "@ai-sdk/amazon-bedrock";
streamText({ model: bedrock("anthropic.claude-3-sonnet-20240229-v1:0"), ... });
```

## Dynamic Model Selection

Pass the model name from the frontend via `body`, then select the provider on the backend:

```tsx
// Frontend
const runtime = useChatRuntime({
  transport: new AssistantChatTransport({
    api: "/api/chat",
    body: { model: "gpt-5.4-mini" },
  }),
});
```

```ts
// Backend
const { messages, model } = await req.json();

const provider = model.startsWith("claude")
  ? anthropic(model)
  : openai(model);

const result = streamText({
  model: provider,
  messages: await convertToModelMessages(messages),
});
```

## With Cloud Persistence

Pass a `cloud` instance to `useChatRuntime` to enable thread persistence and history. Use `ThreadList` to display saved threads.

```tsx
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { AssistantCloud } from "assistant-cloud";
import { Thread } from "@/components/assistant-ui/thread";
import { ThreadList } from "@/components/assistant-ui/thread-list";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";

const cloud = new AssistantCloud({
  baseUrl: process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL,
  authToken: async () => getAuthToken(),
});

function ChatPage() {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({ api: "/api/chat" }),
    cloud,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadList />
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

See the `/cloud` skill for authentication and configuration details.

## Troubleshooting

**"Module not found: @ai-sdk/react"**
```bash
npm install @ai-sdk/react@^4
```

**"useChat is not a function"**
Mixing AI SDK majors. Align `ai`, `@ai-sdk/react`, and the provider packages:
```bash
npm install ai@^7 @ai-sdk/react@^4 @ai-sdk/openai@latest
```

**Streaming stops mid-response**
Check `stopWhen` when using tools - use `stepCountIs(n)` to allow multi-step.

**Tool results not showing**
Ensure you return from tool.execute(), not just mutate state.

## Known Pitfalls

- `convertToModelMessages` is async: always `await` it.
- Build route responses with `createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) })`. `toDataStreamResponse()` is gone; `result.toUIMessageStreamResponse()` is deprecated.
- In v6+ tool definitions, use `inputSchema`, NOT `parameters`.
- `stopWhen: stepCountIs(n)` replaces `maxSteps: n` for multi-step tool loops.
- If you replace the transport, use `AssistantChatTransport` unless you intentionally want to disable assistant-tool/system forwarding.
- `@ai-sdk/openai@^4` pairs with `ai@^7`; provider packages have their own major line.
