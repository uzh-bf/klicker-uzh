# Data Stream Format

AI SDK compatible streaming format.

## Overview

Data Stream is the underlying format used by Vercel AI SDK. For assistant-ui, build the response with `toUIMessageStream` + `createUIMessageStreamResponse`, which layer the UI-message protocol on top of Data Stream.

## Usage

### Server (AI SDK)

```ts
import { openai } from "@ai-sdk/openai";
import {
  streamText,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
} from "ai";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai("gpt-5.4-nano"),
    messages: await convertToModelMessages(messages),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
```

`result.toUIMessageStreamResponse()` is the older equivalent; it still compiles in `ai@7` but is deprecated. `toDataStreamResponse()` was removed after v5.

### Custom Backend (Data Stream SSE)

```ts
import { createAssistantStreamResponse } from "assistant-stream";

export async function POST(req: Request) {
  return createAssistantStreamResponse(async (stream) => {
    stream.appendText("Hello ");
    stream.appendText("world!");

    const tool = stream.addToolCallPart({
      toolCallId: "call_123",
      toolName: "search",
    });
    tool.argsText.append('{"query":"weather NYC"}');
    tool.argsText.close();
    tool.setResponse({ result: { temperature: 22 } });

    stream.close();
  });
}
```

### Decoding

```ts
import { AssistantStream, DataStreamDecoder } from "assistant-stream";

const stream = AssistantStream.fromResponse(response, new DataStreamDecoder());

for await (const chunk of stream) {
  if (chunk.type === "text-delta") console.log("Text:", chunk.textDelta);
  if (chunk.type === "result") console.log("Result:", chunk.result);
}
```

## AssistantStreamController (what you get in createAssistantStreamResponse)

- `appendText(text: string)`
- `appendReasoning(reasoning: string)`
- `appendSource({ sourceType: "url", id, url, title?, parentId? })`
- `appendFile({ data, mimeType })`
- `addToolCallPart({ toolCallId, toolName, parentId? })` → controller with:
  - `argsText.append(text)`, `argsText.close()`
  - `setResponse({ result, artifact?, isError? })`
  - `close()`
- `close()` to end the message

## Event Types

Decoded `AssistantStreamChunk` shapes:

- `part-start` with `part.type` = `"text" | "reasoning" | "tool-call" | "source" | "file"`
- `part-finish` and `tool-call-args-text-finish`
- `text-delta` / `annotations` / `data`
- `result` (tool results)
- `step-start` / `step-finish` / `message-finish`
- `error`

## Wire Format

Data Stream uses Server-Sent Events (SSE) format:

```
0:"Hello "
0:"world!"
d:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0}}
```

Each line:
- `0:` - Text content
- `9:` - Tool call
- `b:` - Tool call start
- `c:` - Tool call args text delta
- `a:` - Tool result
- `d:` - Message finish
- `e:` - Step finish
- `3:` - Error
- `h:` - Source
- `k:` - File
- `aui-*` - assistant-ui extensions (state updates, parented deltas)

## Integration with useChatRuntime

```tsx
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";

function Chat() {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: "/api/chat",
    }),
    // Data Stream format is automatically handled
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```
