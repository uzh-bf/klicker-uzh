# LangSmith

Trace AI SDK route handlers into LangSmith with `wrapAISDK`. Use this when your route talks to AI SDK directly; with `@assistant-ui/react-langgraph`, tracing flows through LangGraph Cloud automatically.

## How it works

LangSmith wraps the `ai` namespace. Call `wrapAISDK(ai)`, get back the same exports (`generateText`, `streamText`, `generateObject`, `streamObject`), and use those in place of the originals. Every call is then traced: your route calls the wrapped `streamText`, which routes through the LangSmith client to LangSmith.

## Setup

Get an API key from [smith.langchain.com](https://smith.langchain.com/), then set environment variables. `LANGSMITH_PROJECT` controls which project receives traces; the default project applies if you omit it.

```bash
# .env.local
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=lsv2_pt_...
LANGSMITH_PROJECT=assistant-ui
```

Install the LangSmith SDK.

```bash
npm install langsmith
```

## Wrap the AI SDK

Destructure the wrapped exports from `wrapAISDK(ai)` and use them in your route.

```ts
import * as ai from "ai";
import { wrapAISDK } from "langsmith/experimental/vercel";
import { openai } from "@ai-sdk/openai";
import type { UIMessage } from "ai";

const { streamText } = wrapAISDK(ai);

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const result = streamText({
    model: openai("gpt-5.4-nano"),
    messages: await ai.convertToModelMessages(messages),
  });
  return ai.createUIMessageStreamResponse({
    stream: ai.toUIMessageStream({ stream: result.stream }),
  });
}
```

Note: `convertToModelMessages`, `toUIMessageStream`, and `createUIMessageStreamResponse` are not part of the wrapper; call them off the `ai` namespace directly.

## Metadata for grouping (optional)

Pass a `langsmith` provider option to tag traces with user, session, or run identifiers. Build the value with `createLangSmithProviderOptions`.

```ts
import { createLangSmithProviderOptions } from "langsmith/experimental/vercel";

const result = streamText({
  model: openai("gpt-5.4-nano"),
  messages: await ai.convertToModelMessages(messages),
  providerOptions: {
    langsmith: createLangSmithProviderOptions({
      name: "chat-completion",
      metadata: { userId, threadId },
    }),
  },
});
```

`name` becomes the run name in LangSmith. Traces filter by the metadata fields you pass; resolve `userId` and `threadId` from your auth and thread state, don't ship literal strings.

## Serverless flush

Serverless functions exit before LangSmith flushes batched traces. Before returning, force the flush with the `Client` from `langsmith`; without it you lose traces on Vercel, AWS Lambda, and similar platforms.

```ts
import { Client } from "langsmith";

const client = new Client();
await client.awaitPendingTraceBatches();
```

## Verify

Send a message; the trace should appear in your LangSmith project within seconds. Confirm a new run named according to `name` (or the default `streamText`), that inputs, outputs, token usage, and latency are populated, and that metadata fields show up as filters.

## Notes

- `experimental_telemetry` vs `wrapAISDK`: the AI SDK's generic `experimental_telemetry` flag emits OpenTelemetry spans (the path Langfuse uses). `wrapAISDK` is LangSmith's own path; you do not need to set `experimental_telemetry` when using it.
- LangGraph users: if your backend is LangGraph Cloud, prefer the LangGraph runtime; tracing is built in. Use `wrapAISDK` only when calling AI SDK directly.
- Version requirements: LangSmith documents AI SDK v5 as the minimum and `langsmith >= 0.3.63`. The wrapper continues to work against v6 in practice; if you hit an incompatibility, check LangSmith's release notes.
