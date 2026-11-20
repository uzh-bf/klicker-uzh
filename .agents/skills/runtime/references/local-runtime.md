# useLocalRuntime

In-browser chat with custom model adapter.

## Basic Usage

```tsx
import { useLocalRuntime, AssistantRuntimeProvider } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";

function App() {
  const runtime = useLocalRuntime({
    model: {
      async run({ messages, abortSignal }) {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages }),
          signal: abortSignal,
        });

        const data = await response.json();
        return {
          content: [{ type: "text", text: data.text }],
        };
      },
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

## Streaming Response

Use a generator and emit `ChatModelRunResult` chunks (append-only content parts):

```tsx
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

        // Split on newlines for this plain-text example (not Data Stream)
        const parts = buffer.split("\n");
        buffer = parts.pop() ?? "";

        for (const textChunk of parts.filter(Boolean)) {
          yield {
            content: [{ type: "text", text: textChunk }],
          };
        }
      }

      if (buffer) {
        yield { content: [{ type: "text", text: buffer }] };
      }
    },
  },
});
```

## Options

```tsx
interface LocalRuntimeOptions {
  model: ChatModelAdapter;
  initialMessages?: ThreadMessage[];
  adapters?: {
    attachments?: AttachmentAdapter;
    feedback?: FeedbackAdapter;
    speech?: SpeechSynthesisAdapter;
  };
}
```

## ChatModelAdapter

```tsx
interface ChatModelAdapter {
  run(
    options: ChatModelRunOptions,
  ): Promise<ChatModelRunResult> | AsyncGenerator<ChatModelRunResult>;
}

interface ChatModelRunOptions {
  messages: readonly ThreadMessage[];
  abortSignal: AbortSignal;
  runConfig: RunConfig;     // per-run configuration
  context: ModelContext;    // tools, system prompt, callSettings, config
}

// Returned once (final) or yielded repeatedly (streaming).
// All fields are optional; yield partial content to stream.
interface ChatModelRunResult {
  content?: MessagePart[];
  status?: MessageStatus;   // object form, e.g. { type: "complete" }
  metadata?: Record<string, unknown>;
}
```

## With OpenAI Direct

```tsx
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true, // Only for demos
});

const runtime = useLocalRuntime({
  model: {
    async *run({ messages, abortSignal }) {
      const stream = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content
            .filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join(""),
        })),
        stream: true,
      });

      for await (const chunk of stream) {
        if (abortSignal.aborted) break;
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          yield { content: [{ type: "text", text: delta }] };
        }
      }
    },
  },
});
```

## With Tools

Emit tool calls as message parts (`type: "tool-call"`) and include `argsText` plus optional `result`:

```tsx
const runtime = useLocalRuntime({
  model: {
    async *run({ messages, abortSignal }) {
      const toolCallId = "1";

      yield {
        content: [
          {
            type: "tool-call",
            toolCallId,
            toolName: "get_weather",
            args: { city: "NYC" },
            argsText: '{"city":"NYC"}',
          },
        ],
      };

      const result = await getWeather({ city: "NYC" });

      // Send result on the same tool-call part
      yield {
        content: [
          {
            type: "tool-call",
            toolCallId,
            toolName: "get_weather",
            args: { city: "NYC" },
            argsText: '{"city":"NYC"}',
            result,
          },
          { type: "text", text: `The weather in NYC is ${result.temp}°C` },
        ],
      };
    },
  },
});
```

## With Attachments

```tsx
const runtime = useLocalRuntime({
  model: {
    async run({ messages }) {
      const lastMessage = messages[messages.length - 1];
      const attachments = lastMessage.attachments || [];

      for (const attachment of attachments) {
        if (attachment.type === "image") {
        }
      }

      return { content: [{ type: "text", text: "Processed" }] };
    },
  },
  adapters: {
    attachments: {
      accept: "image/*",
      // add() returns a PendingAttachment
      async add({ file }) {
        return {
          id: crypto.randomUUID(),
          type: "image",
          name: file.name,
          contentType: file.type,
          file,
          status: { type: "requires-action", reason: "composer-send" },
        };
      },
      // send() returns a CompleteAttachment with content parts
      async send(attachment) {
        const dataUrl = await readAsDataURL(attachment.file);
        return {
          ...attachment,
          status: { type: "complete" },
          content: [{ type: "image", image: dataUrl }],
        };
      },
      async remove() {},
    },
  },
});
```

## With Initial Messages

```tsx
const runtime = useLocalRuntime({
  model: { ... },
  initialMessages: [
    {
      id: "1",
      role: "assistant",
      content: [{ type: "text", text: "Hello! How can I help you?" }],
      status: { type: "complete" },
      createdAt: new Date(),
    },
  ],
});
```

## Error Handling

```tsx
const runtime = useLocalRuntime({
  model: {
    async *run({ messages, abortSignal }) {
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          body: JSON.stringify({ messages }),
          signal: abortSignal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        // ... process response
      } catch (error) {
        if (error.name === "AbortError") {
          // User cancelled - normal, don't throw
          return;
        }
        throw error; // Re-throw to show error in UI
      }
    },
  },
});
```
