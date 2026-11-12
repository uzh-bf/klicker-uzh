# LangChain React Runtime

A thin LangGraph adapter via `@assistant-ui/react-langchain`. `useStreamRuntime` wraps `useStream` from `@langchain/react` and exposes it as an assistant-ui runtime, delegating stream plumbing to the upstream hook. It targets the same backend as `@assistant-ui/react-langgraph` (LangGraph Cloud) but at a higher level.

## Contents

- [Installation](#installation)
- [Basic setup](#basic-setup)
- [Environment variables](#environment-variables)
- [useStreamRuntime options](#usestreamruntime-options)
- [Reading custom state keys](#reading-custom-state-keys)
- [Interrupts](#interrupts)
- [Message conversion](#message-conversion)
- [Cloud persistence](#cloud-persistence)
- [Custom messagesKey](#custom-messageskey)
- [react-langgraph vs react-langchain](#react-langgraph-vs-react-langchain)

## Installation

```bash
npm install @assistant-ui/react @assistant-ui/react-langchain @langchain/react @langchain/langgraph-sdk
```

## Basic setup

`useStreamRuntime` takes `assistantId` and `apiUrl`. There is no `stream` / `create` / `load` to write; thread plumbing is handled by the upstream `useStream`.

```tsx
"use client";

import { Thread } from "@/components/assistant-ui/thread";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useStreamRuntime } from "@assistant-ui/react-langchain";

export function MyAssistant() {
  const runtime = useStreamRuntime({
    assistantId: process.env["NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID"]!,
    apiUrl: process.env["NEXT_PUBLIC_LANGGRAPH_API_URL"],
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

The runtime is layered on `ExternalStoreRuntime`. Graph state is the source of truth; it renders messages from `state.values.messages` and submits user input back to the graph. The graph state must include a `messages` key with LangChain-alike messages, or you pass a custom `messagesKey`.

## Environment variables

Point at a LangGraph Cloud API server (locally via LangGraph Studio, or hosted via LangSmith).

```
NEXT_PUBLIC_LANGGRAPH_API_URL=http://localhost:2024
NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID=your_graph_id
```

## useStreamRuntime options

`useStreamRuntime` accepts every option upstream `useStream` does (`UseStreamOptions`), plus three assistant-ui specific fields.

| Option | Type | Description |
|---|---|---|
| `cloud` | `AssistantCloud` | Optional. Persists threads via assistant-cloud. |
| `adapters` | `{ attachments?, speech?, feedback? }` | Optional. Attachment, speech, and feedback adapters. |
| `messagesKey` | `string` | The state key that holds messages. Defaults to `"messages"`. |

## Reading custom state keys

LangGraph agents often expose structured state beyond messages (plans, todos, scratch files). Read them directly with `useLangChainState`. It mirrors `useStream().values[key]` upstream and updates when the stream emits new state.

```tsx
import { useLangChainState } from "@assistant-ui/react-langchain";

type Todo = { id: string; title: string; done: boolean };

function TodoList() {
  const todos = useLangChainState<Todo[]>("todos", []);
  return (
    <ul>
      {todos.map((t) => (
        <li key={t.id}>
          {t.done ? "✓" : "○"} {t.title}
        </li>
      ))}
    </ul>
  );
}
```

Signatures:

```ts
useLangChainState<T>(key: string): T | undefined;
useLangChainState<T>(key: string, defaultValue: T): T;
```

Note: reading the state key directly avoids reconstructing a list from partial tool-call args (for example the `deepagents` middleware updates `state.todos` alongside the tool-call stream).

## Interrupts

LangGraph interrupts pause the graph and wait for client input. `useLangChainInterruptState` exposes the current interrupt; `useLangChainSubmit` resumes the graph with a raw state update.

```tsx
import {
  useLangChainInterruptState,
  useLangChainSubmit,
} from "@assistant-ui/react-langchain";
import { Command } from "@langchain/langgraph-sdk";

function InterruptPrompt() {
  const interrupt = useLangChainInterruptState();
  const submit = useLangChainSubmit();
  if (!interrupt) return null;
  return (
    <div>
      <pre>{JSON.stringify(interrupt.value, null, 2)}</pre>
      <button
        onClick={() =>
          submit(null, { command: new Command({ resume: "approved" }) })
        }
      >
        Approve
      </button>
    </div>
  );
}
```

## Message conversion

`convertLangChainBaseMessage` transforms a LangChain `BaseMessage` into an assistant-ui message. Use it when building a custom `ExternalStoreAdapter` that consumes LangChain messages outside `useStreamRuntime`.

```ts
import { convertLangChainBaseMessage } from "@assistant-ui/react-langchain";
```

## Cloud persistence

Pass an `AssistantCloud` instance to persist threads across sessions. The runtime automatically wires thread list management and resumes state from the cloud.

```tsx
const runtime = useStreamRuntime({
  cloud,
  assistantId: "agent",
  apiUrl: "http://localhost:2024",
});
```

See the `/cloud` skill for authentication and configuration details.

## Custom messagesKey

If your graph stores messages under a non-default key, pass `messagesKey` so the runtime submits tool results and human turns to the correct state slot.

```ts
const runtime = useStreamRuntime({
  assistantId: "agent",
  apiUrl: "http://localhost:2024",
  messagesKey: "chat_messages",
});
```

## react-langgraph vs react-langchain

Both packages connect assistant-ui to LangGraph backends and both build on `useExternalStoreRuntime`. They are independent adapters for different upstream libraries; one is not a successor to the other. `react-langgraph` wraps the raw `@langchain/langgraph-sdk` (~7,500 lines); `react-langchain` wraps `useStream` from `@langchain/react` (~600 lines).

Pick `react-langchain` when your app already depends on `@langchain/react`, when you want to read custom state keys reactively with `useLangChainState<T>(key)`, or when you prefer a thin wrapper pinned to upstream behavior. Pick `react-langgraph` for the `with-langgraph` example (`npx assistant-ui@latest create <name> --example with-langgraph`), or when you need per-message metadata, generative UI messages, subgraph/namespaced stream events, or end-to-end cancellation today. Features absent from `react-langchain` have not been ported, not deprecated.

Hook name mapping:

| react-langgraph | react-langchain | Notes |
|---|---|---|
| `useLangGraphRuntime` | `useStreamRuntime` | Options extend upstream `UseStreamOptions`; no `stream` / `create` / `load` to write. |
| `useLangGraphInterruptState` | `useLangChainInterruptState` | Same return shape. |
| `useLangGraphSendCommand` | `useLangChainSubmit` | `submit(values, { command })` replaces the dedicated hook. |
| `useLangGraphSend` | use `runtime.thread.append` | No direct equivalent; send turns through the runtime. |
| `useLangGraphMessageMetadata` | not available | Open an issue if you rely on this. |
| `useLangGraphUIMessages` | not available | Open an issue if you rely on this. |
| *(none)* | `useLangChainState<T>(key)` | Reads any custom state key reactively. |

See the `langgraph.md` reference for the full-featured adapter.
