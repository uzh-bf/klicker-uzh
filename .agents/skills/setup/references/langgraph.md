# LangGraph Setup

Integration with LangGraph agents via `@assistant-ui/react-langgraph`.

## Installation

```bash
npm install @assistant-ui/react @assistant-ui/react-langgraph @langchain/langgraph-sdk
```

## Client

```ts
// lib/chatApi.ts
import { Client } from "@langchain/langgraph-sdk";

export const createClient = () =>
  new Client({
    apiUrl: process.env.NEXT_PUBLIC_LANGGRAPH_API_URL ?? "http://localhost:8123",
  });
```

## Basic Setup

`useLangGraphRuntime` takes a `stream` callback plus optional `create` / `load` / `delete` handlers for thread lifecycle. Build the stream with `unstable_createLangGraphStream`.

```tsx
"use client";

import { useMemo } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";
import {
  unstable_createLangGraphStream,
  useLangGraphRuntime,
  type LangChainMessage,
} from "@assistant-ui/react-langgraph";
import { createClient } from "@/lib/chatApi";

const ASSISTANT_ID = process.env.NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID!;

export function MyAssistant() {
  const client = useMemo(() => createClient(), []);
  const stream = useMemo(
    () => unstable_createLangGraphStream({ client, assistantId: ASSISTANT_ID }),
    [client],
  );

  const runtime = useLangGraphRuntime({
    unstable_allowCancellation: true,
    stream,
    create: async () => {
      const { thread_id } = await client.threads.create();
      return { externalId: thread_id };
    },
    load: async (externalId) => {
      const state = await client.threads.getState<{
        messages: LangChainMessage[];
      }>(externalId);
      return {
        messages: state.values.messages,
        interrupts: state.tasks[0]?.interrupts,
      };
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

## useLangGraphRuntime Options

```tsx
const runtime = useLangGraphRuntime({
  // Required: stream callback (typically from unstable_createLangGraphStream)
  stream,

  // Optional thread lifecycle (enables history, switching, and persistence)
  create: async () => ({ externalId: "thread-id" }),
  load: async (externalId, { signal } = {}) => ({
    messages: [],
    interrupts: [],
  }),
  delete: async (externalId) => {},

  // Optional: enables message editing and regeneration via server-side forking
  getCheckpointId: (threadId, parentMessages) => undefined,

  autoCancelPendingToolCalls: true,
  unstable_allowCancellation: true, // enable the cancel button

  adapters: {
    attachments: attachmentAdapter,
    feedback: feedbackAdapter,
    speech: speechAdapter,
  },

  eventHandlers: {
    onMessageChunk: (chunk) => {},
    onMetadata: (event) => {},
    onError: (error) => {},
    onCustomEvent: (event, options) => {},
  },
});
```

`useLangGraphRuntime` no longer takes `threadId` or `convertMessage`. Thread identity is handled by `create`/`load`/`delete` (the v0.7 migration removed `onSwitchToThread`; use `load` instead).

## Custom Stream (Advanced)

Instead of `unstable_createLangGraphStream`, you can pass your own `LangGraphStreamCallback`. It receives the messages and a config object (with `abortSignal`) and yields LangGraph message events:

```tsx
const runtime = useLangGraphRuntime({
  stream: async function* (messages, { abortSignal, ...config }) {
    const response = await fetch("/api/langgraph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, config }),
      signal: abortSignal,
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const event of parseLangGraphEvents(decoder.decode(value))) {
        yield event; // LangGraphMessagesEvent
      }
    }
  },
});
```

## With Tool UI

LangGraph tool calls can have custom UI. Remember the render prop `status` is an object; branch on `status.type`.

```tsx
import { makeAssistantToolUI } from "@assistant-ui/react";

const SearchToolUI = makeAssistantToolUI({
  toolName: "tavily_search",
  render: ({ args, result, status }) => {
    if (status.type === "running") {
      return <div>Searching for: {args.query}...</div>;
    }
    return (
      <div>
        {result?.results?.map((r: any) => (
          <a key={r.url} href={r.url}>
            {r.title}
          </a>
        ))}
      </div>
    );
  },
});
```

## Python Backend Example

```python
# langgraph_server.py
from langgraph.graph import StateGraph, MessagesState
from langchain_openai import ChatOpenAI

model = ChatOpenAI(model="gpt-4o")

def chat_node(state: MessagesState):
    response = model.invoke(state["messages"])
    return {"messages": [response]}

graph = StateGraph(MessagesState)
graph.add_node("chat", chat_node)
graph.set_entry_point("chat")
graph.set_finish_point("chat")

app = graph.compile()

# Run with: langgraph dev
```

## Thread Persistence

LangGraph handles thread persistence server-side. The `create` handler returns the LangGraph `thread_id` as `externalId`, and `load` rehydrates a thread's messages and interrupts when the user switches to it. Combine with the assistant-ui `ThreadList` (cloud or a remote thread list adapter) to show saved threads.

## Troubleshooting

**"Stream not yielding events"**
Ensure your stream yields `LangGraphMessagesEvent` chunks. When using `unstable_createLangGraphStream`, verify `assistantId` matches a graph registered on your LangGraph server.

**"Thread not persisting"**
LangGraph persistence is server-side. Check that your server is configured with a checkpointer, and that `create`/`load` are wired up.

**"Tool calls not rendering"**
Tool names must match between LangGraph and `makeAssistantToolUI`.
