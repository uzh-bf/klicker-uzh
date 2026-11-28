# Langfuse

Trace AI SDK calls into Langfuse via OpenTelemetry for tracing, evals, and prompt management.

## Contents

- [How it works](#how-it-works)
- [Environment variables](#environment-variables)
- [Packages](#packages)
- [instrumentation.ts](#instrumentationts)
- [Next.js 14 config](#nextjs-14-config)
- [Route handler](#route-handler)
- [Trace metadata](#trace-metadata)
- [Serverless: forceFlush](#serverless-forceflush)

## How it works

There is no proxy and no client wrapping. `streamText` (or `generateText`) emits OpenTelemetry spans when `experimental_telemetry` is enabled. A `LangfuseSpanProcessor` registered on the OTel `NodeSDK` ships those spans to Langfuse, which renders them as traces.

`@langfuse/tracing` provides the helpers that label traces (user, session, trace name). `@langfuse/otel` provides the span processor.

## Environment variables

```bash
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

`LANGFUSE_BASE_URL` selects the region: EU is `https://cloud.langfuse.com`, US is `https://us.cloud.langfuse.com`, or point it at a self-hosted instance.

## Packages

```bash
npm install @langfuse/tracing @langfuse/otel @opentelemetry/sdk-node
```

## instrumentation.ts

Create `instrumentation.ts` at the project root. Export the processor so route handlers can flush it later (see [Serverless: forceFlush](#serverless-forceflush)).

```ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

export const langfuseSpanProcessor = new LangfuseSpanProcessor();

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const sdk = new NodeSDK({
    spanProcessors: [langfuseSpanProcessor],
  });
  sdk.start();
}
```

Note: the `NEXT_RUNTIME` guard skips the edge runtime, where OTel does not run.

## Next.js 14 config

Next.js 15 calls `register()` automatically. On Next.js 14 and earlier, opt in via `next.config.mjs`:

```js
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
```

## Route handler

Enable telemetry by setting `experimental_telemetry` directly on `streamText`. The same flag works on `generateText`.

```ts
import { openai } from "@ai-sdk/openai";
import {
  streamText,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
} from "ai";
import type { UIMessage } from "ai";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    messages: await convertToModelMessages(messages),
    experimental_telemetry: { isEnabled: true },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
```

## Trace metadata

Wrap the call in `propagateAttributes` from `@langfuse/tracing` to attach a trace name, user, and session so Langfuse can group and filter runs.

```ts
import { openai } from "@ai-sdk/openai";
import {
  streamText,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
} from "ai";
import type { UIMessage } from "ai";
import { propagateAttributes } from "@langfuse/tracing";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const userId = "<resolve from your session>";
  const sessionId = "<resolve from your thread state>";

  const result = await propagateAttributes(
    { traceName: "chat-completion", userId, sessionId },
    async () =>
      streamText({
        model: openai("gpt-4o"),
        messages: await convertToModelMessages(messages),
        experimental_telemetry: { isEnabled: true },
      }),
  );

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
```

## Serverless: forceFlush

On serverless platforms the function can exit before OTel flushes its buffer, dropping traces. Import the processor exported from `instrumentation.ts` and flush it before responding, or hand the flush to the runtime's `waitUntil`.

```ts
import { langfuseSpanProcessor } from "@/instrumentation";

await langfuseSpanProcessor.forceFlush();
```

Langfuse's own docs cover the deployment-specific flush patterns (for example `waitUntil`) and OTel sampling configuration on `NodeSDK`.
