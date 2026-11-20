---
name: streaming
description: "Streaming backends and wire protocols for assistant-ui via the assistant-stream package. Use when building a custom (non-AI-SDK) streaming endpoint with createAssistantStreamResponse or createAssistantStreamController, emitting parts through appendText/appendReasoning/appendSource/appendFile/addToolCallPart and setResponse; choosing between the AI SDK UI-message format (toUIMessageStream + createUIMessageStreamResponse) and the native Assistant Transport format; encoding or decoding streams with DataStreamEncoder/DataStreamDecoder, AssistantTransportEncoder/AssistantTransportDecoder, PlainTextEncoder, or UIMessageStreamDecoder; or wiring streamed chunks into useLocalRuntime or useChatRuntime. Use specifically for debugging stream wire issues: text-delta, part-start, result events, text/event-stream content-type, SSE format, tool calls not rendering, or partial text not showing. For general non-stream debugging route to the relevant focused skill, not the parent overview."
license: MIT
---

# assistant-ui Streaming

**Always consult [assistant-ui.com/llms.txt](https://www.assistant-ui.com/llms.txt) for the latest API.**

The `assistant-stream` package handles streaming from AI backends.

## References

- [./references/data-stream.md](./references/data-stream.md) -- AI SDK data stream format
- [./references/assistant-transport.md](./references/assistant-transport.md) -- Native assistant-ui format
- [./references/encoders.md](./references/encoders.md) -- Encoders and decoders
- [./references/resumable.md](./references/resumable.md) -- Resumable streams

## When to Use

```
Using Vercel AI SDK?
├─ Yes → createUIMessageStreamResponse + toUIMessageStream (no assistant-stream needed)
└─ No → assistant-stream for custom backends
```

## Installation

```bash
npm install assistant-stream
```

## Custom Streaming Response

```ts
import { createAssistantStreamResponse } from "assistant-stream";

export async function POST(req: Request) {
  return createAssistantStreamResponse(async (stream) => {
    stream.appendText("Hello ");
    stream.appendText("world!");

    const tool = stream.addToolCallPart({ toolCallId: "1", toolName: "get_weather" });
    tool.argsText.append('{"city":"NYC"}');
    tool.argsText.close();
    tool.setResponse({ result: { temperature: 22 } });

    stream.close();
  });
}
```

## With useLocalRuntime

`useLocalRuntime` expects `ChatModelRunResult` chunks. Yield content parts for streaming:

```tsx
import { useLocalRuntime } from "@assistant-ui/react";

const runtime = useLocalRuntime({
  model: {
    async *run({ messages, abortSignal }) {
      const response = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ messages }),
        signal: abortSignal,
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n");
        buffer = parts.pop() ?? "";

        for (const chunk of parts.filter(Boolean)) {
          yield { content: [{ type: "text", text: chunk }] };
        }
      }
    },
  },
});
```

## Debugging Streams

```ts
import { AssistantStream, DataStreamDecoder } from "assistant-stream";

const stream = AssistantStream.fromResponse(response, new DataStreamDecoder());
for await (const event of stream) {
  console.log("Event:", JSON.stringify(event, null, 2));
}
```

## Stream Event Types

- `part-start` with `part.type` = `"text" | "reasoning" | "tool-call" | "source" | "file"`
- `text-delta` with streamed text
- `result` with tool results
- `step-start`, `step-finish`, `message-finish`
- `error` strings

## Common Gotchas

**Stream not updating UI**
- Check Content-Type is `text/event-stream`
- Check for CORS errors

**Tool calls not rendering**
- `addToolCallPart` needs both `toolCallId` and `toolName`
- Register tool UI with `makeAssistantToolUI`

**Partial text not showing**
- Use `text-delta` events for streaming
