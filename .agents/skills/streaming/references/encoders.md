# Encoders and Decoders

Encode and decode streaming formats.

## Available Encoders

| Encoder | Format | Use Case |
|---------|--------|----------|
| `DataStreamEncoder` | AI SDK Data Stream | Default (the wire format behind `toUIMessageStream`) |
| `AssistantTransportEncoder` | Native SSE (`data: {chunk}`) | Custom backends that want all chunk types |
| `PlainTextEncoder` | Text-only | Very simple demos |

## DataStreamEncoder

AI SDK compatible format. You normally don't call it directly. Wrap an `AssistantStream`:

```ts
import { AssistantStream, DataStreamEncoder, DataStreamDecoder } from "assistant-stream";

const response = AssistantStream.toResponse(stream, new DataStreamEncoder());

const stream = AssistantStream.fromResponse(response, new DataStreamDecoder());
for await (const chunk of stream) {
  console.log(chunk);
}
```

## AssistantTransportEncoder

Native assistant-ui format with all features.

```ts
import {
  AssistantTransportEncoder,
  AssistantTransportDecoder,
} from "assistant-stream";

const response = AssistantStream.toResponse(stream, new AssistantTransportEncoder());

const stream = AssistantStream.fromResponse(response, new AssistantTransportDecoder());
for await (const chunk of stream) {
  console.log(chunk);
}
```

## PlainTextEncoder

Simple text-only streaming.

```ts
import { PlainTextEncoder, PlainTextDecoder } from "assistant-stream";

const encoder = new PlainTextEncoder();
const stream = encoder.encode("Hello world!");

const decoder = new PlainTextDecoder();
for await (const text of decoder.decode(stream)) {
  console.log(text);
}
```

## UIMessageStreamDecoder

Optimized for UI rendering - accumulates into message state.

```ts
import { UIMessageStreamDecoder } from "assistant-stream";

const decoder = new UIMessageStreamDecoder();

for await (const update of decoder.decode(stream)) {
  // update contains full message state ready for UI
  setMessages(update.messages);
}
```

## Creating Custom Streams

### From Response

```ts
const response = await fetch("/api/chat", { ... });
const stream = AssistantStream.fromResponse(response, new DataStreamDecoder());
```

## Server Response Helpers

Build a stream with `createAssistantStreamController` and encode it via `AssistantStream.toResponse(stream, encoder)`, or use `createAssistantStreamResponse` for the Data Stream default. See [./assistant-transport.md](./assistant-transport.md) and [./data-stream.md](./data-stream.md) for full server examples.

## Debugging

### Log Raw Stream

```ts
const response = await fetch("/api/chat", { ... });
const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (reader) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log("Raw:", decoder.decode(value));
}
```

### Validate Format

```ts
const contentType = response.headers.get("Content-Type");
console.log("Content-Type:", contentType);  // Should be text/event-stream
```
