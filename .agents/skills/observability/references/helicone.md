# Helicone

Log and monitor LLM calls by routing them through the Helicone proxy. No SDK or wrapper is needed; you only change the provider's `baseURL` and add an auth header.

## How It Works

Helicone is a proxy. Point your OpenAI provider at Helicone's gateway instead of `api.openai.com`, and every request is logged (cost, latency, prompts, completions) before being forwarded to OpenAI. Streaming, tools, and attachments keep working unchanged because the request shape is identical.

## Environment Variables

```
HELICONE_API_KEY=sk-helicone-...
OPENAI_API_KEY=sk-...
```

Server-side only. Never set the Helicone key in client code.

## Route Setup (AI SDK)

Create the provider with `createOpenAI` from `@ai-sdk/openai`, override `baseURL`, and attach the `Helicone-Auth` header. Use the provider exactly as you would the default `openai` export.

```ts
import { createOpenAI } from "@ai-sdk/openai";
import {
  streamText,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
} from "ai";
import type { UIMessage } from "ai";

const openai = createOpenAI({
  baseURL: "https://oai.helicone.ai/v1",
  headers: {
    "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
  },
});

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const result = streamText({
    model: openai("gpt-5.4-mini"),
    messages: await convertToModelMessages(messages),
  });
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
```

The `OPENAI_API_KEY` env var is still read by `createOpenAI`; Helicone forwards it to OpenAI.

## Route Setup (OpenAI SDK)

If you call the OpenAI SDK directly instead of the AI SDK, set `baseURL` and `defaultHeaders` on the client.

```ts
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "https://oai.helicone.ai/v1",
  defaultHeaders: {
    "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
  },
});

export async function POST(req: Request) {
  const { messages } = await req.json();
  const stream = await openai.chat.completions.create({
    model: "gpt-5.4-mini",
    messages,
    stream: true,
  });
  return new Response(stream.toReadableStream());
}
```

## Custom Metadata

Add per request headers to tag and filter sessions in the Helicone dashboard. Pass them alongside `Helicone-Auth` in the `headers` (AI SDK) or `defaultHeaders` (OpenAI SDK) object.

```ts
const openai = createOpenAI({
  baseURL: "https://oai.helicone.ai/v1",
  headers: {
    "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
    "Helicone-User-Id": "user_123",
    "Helicone-Property-App": "support-bot",
  },
});
```

`Helicone-User-Id` groups requests by end user; any `Helicone-Property-*` header becomes a custom filterable dimension.

## Other Providers

For Anthropic, Gemini, and others, swap the base URL to the matching Helicone gateway. See Helicone's provider docs for the exact host per provider; the auth header stays the same.
