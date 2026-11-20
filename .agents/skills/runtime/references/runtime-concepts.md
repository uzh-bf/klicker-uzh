# Runtime Concepts

Cross-cutting runtime concepts: the `unstable_` stability policy, how the runtimes layer, state-streaming custom agents, and message timing.

## Contents

- [The unstable_ stability policy](#the-unstable_-stability-policy)
- [Runtime layering: LocalRuntime vs ExternalStoreRuntime](#runtime-layering-localruntime-vs-externalstoreruntime)
- [useAssistantTransportRuntime (state-streaming agents)](#useassistanttransportruntime-state-streaming-agents)
- [Reading agent state and sending commands](#reading-agent-state-and-sending-commands)
- [Typing agent state](#typing-agent-state)
- [Message timing (experimental)](#message-timing-experimental)
- [Supplying timing manually](#supplying-timing-manually)

## The unstable_ stability policy

APIs prefixed with `unstable_` are publicly exported and meant to be built against, but their signature, naming, semantics, and return shape may change in any release, including patch releases. They carry no semver guarantees, so a breaking change can land in a patch or minor, not only a major.

```ts
import { unstable_createMessageConverter as createMessageConverter } from "@assistant-ui/react";
```

When an API stabilizes, the prefix is dropped (`unstable_foo` becomes `foo`). The old name is kept as a deprecated alias for at least one minor cycle, and the changelog notes the transition. Breaking changes are announced in the GitHub release notes and the migration guides under `/docs/migrations`.

Recommended practices when consuming an `unstable_` API:

- Pin your dependency range so updates do not silently break the integration.
- Isolate the call site behind a thin wrapper, so an upstream rename touches one file.
- Expect renames or removals at stabilization time.

Examples of currently unstable exports: `unstable_createMessageConverter`, `unstable_humanToolNames` (`@assistant-ui/react`), `unstable_createLangGraphStream` (`@assistant-ui/react-langgraph`), `unstable_capabilities` on `ExternalStoreRuntime`, and the `unstable_state`, `unstable_annotations`, `unstable_data` message metadata fields.

## Runtime layering: LocalRuntime vs ExternalStoreRuntime

`ExternalStoreRuntime` is the lowest-level runtime. You own the message array and `isRunning` flag, and you implement `onNew`, `onEdit`, `onReload`, and friends against whatever store you already use (React state, Redux, Zustand). assistant-ui reads from your store and never holds its own copy. See `external-store.md`.

```tsx
const runtime = useExternalStoreRuntime({
  messages,
  isRunning,
  onNew: async (message) => { /* you mutate your store */ },
});
```

`LocalRuntime` sits above it. assistant-ui owns the message store, branching, and run lifecycle; you implement only a `ChatModelAdapter.run` that yields `ChatModelRunResult` chunks. Edit, reload, branch switching, and cancellation come for free. See `local-runtime.md`.

```tsx
const runtime = useLocalRuntime({
  model: {
    async *run({ messages, abortSignal }) {
      yield { content: [{ type: "text", text: "..." }] };
    },
  },
});
```

Note: reach for `ExternalStoreRuntime` when an external system is the source of truth for messages; reach for `LocalRuntime` when you only need to provide a model adapter and want message management handled for you.

## useAssistantTransportRuntime (state-streaming agents)

`useAssistantTransportRuntime` (from `@assistant-ui/react`) connects to a custom backend agent that streams its full state, rather than a message delta stream. You hold the agent's state object, and a `converter` projects that state into thread messages on every update.

```tsx
import { useAssistantTransportRuntime, AssistantRuntimeProvider } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";

const runtime = useAssistantTransportRuntime({
  initialState: { messages: [] },
  api: "http://localhost:8010/assistant",
  converter,
  headers: async () => ({ Authorization: "Bearer token" }),
  onError: (error, { commands, updateState }) => {
    updateState((s) => ({ ...s, lastError: error.message }));
  },
});
```

Options:

```ts
interface AssistantTransportRuntimeOptions<T> {
  initialState: T;                 // starting agent state
  api: string;                     // backend endpoint URL
  converter: (
    state: T,
    connectionMetadata: AssistantTransportConnectionMetadata,
  ) => { messages: ThreadMessage[]; isRunning: boolean; state?: ReadonlyJSONValue };

  resumeApi?: string;              // optional reconnect endpoint
  protocol?: "data-stream" | "assistant-transport";
  headers?: Record<string, string> | Headers | (() => Promise<Record<string, string> | Headers>);
  body?: object | (() => Promise<object | undefined>);
  prepareSendCommandsRequest?: (
    body: SendCommandsRequestBody,
  ) => Record<string, unknown> | Promise<Record<string, unknown>>;
  capabilities?: { edit?: boolean };  // editing disabled by default
  adapters?: { attachments?: AttachmentAdapter; history?: ThreadHistoryAdapter };

  onResponse?: (response: Response) => void;
  onFinish?: () => void;
  onError?: (error: Error, params: { commands: Command[]; updateState: (fn: (s: T) => T) => void }) => void | Promise<void>;
  onCancel?: (params: { commands: Command[]; updateState: (fn: (s: T) => T) => void; error?: Error }) => void;
}
```

The `converter` receives `AssistantTransportConnectionMetadata` (exported from `@assistant-ui/react`) describing in-flight work:

```ts
interface AssistantTransportConnectionMetadata {
  pendingCommands: Command[];
  isSending: boolean;
  toolStatuses: Record<string, ToolExecutionStatus>;
}
```

Build the message side of the converter with `unstable_createMessageConverter`, which maps your own message shape to thread messages and back:

```ts
import { unstable_createMessageConverter as createMessageConverter } from "@assistant-ui/react";

const messageConverter = createMessageConverter((message: YourMessage) => ({
  role: message.role,
  content: [{ type: "text", text: message.content }],
}));

const converter = (state: MyState) => ({
  messages: messageConverter.toThreadMessages(state.messages),
  isRunning: false,
});

// Reverse lookup when you need the source message back:
// messageConverter.toOriginalMessage(threadMessage)
```

Note: `unstable_createMessageConverter` is explicitly `unstable_`. The wire format is also subject to change; it is documented as migrating to Server-Sent Events in a future release. Speech, dictation, feedback, and suggestions are not supported by this runtime; drop down to `ExternalStoreRuntime` if you need them.

## Reading agent state and sending commands

Inside components under the provider, read agent state with `useAssistantTransportState` (accepts an optional selector) and issue custom commands with `useAssistantTransportSendCommand`.

```tsx
import {
  useAssistantTransportState,
  useAssistantTransportSendCommand,
} from "@assistant-ui/react";

function CustomField() {
  const value = useAssistantTransportState((s) => s.customField);
  const sendCommand = useAssistantTransportSendCommand();

  return (
    <button onClick={() => sendCommand({ type: "set-field", value: "x" })}>
      {value}
    </button>
  );
}
```

To resume a run, use `resumeRun` via the general runtime accessor `useAui`.

## Typing agent state

Augment the `Assistant.ExternalState` interface so `useAssistantTransportState` and the converter are typed against your state shape:

```ts
declare module "@assistant-ui/react" {
  namespace Assistant {
    interface ExternalState {
      myState: { messages: Message[]; customField: string };
    }
  }
}
```

## Message timing (experimental)

`useMessageTiming` (from `@assistant-ui/react`) returns streaming performance stats for the current message. It must be called inside a `MessagePrimitive.Root` context, and returns `MessageTiming | undefined`; undefined for non-assistant messages or when no timing data exists.

Note: this is experimental. The `useMessageTiming` API and the set of tracked fields may change in future versions.

```tsx
import { useMessageTiming } from "@assistant-ui/react";

function TimingStats() {
  const timing = useMessageTiming();
  if (!timing?.totalStreamTime) return null;

  return (
    <span>
      {timing.tokensPerSecond?.toFixed(1)} tok/s ({timing.totalStreamTime}ms)
    </span>
  );
}
```

The `MessageTiming` shape:

```ts
interface MessageTiming {
  streamStartTime: number;   // Unix timestamp when the stream started
  firstTokenTime?: number;   // time to first text token, in ms
  totalStreamTime?: number;  // total stream duration, in ms
  tokenCount?: number;       // output token count from message metadata usage
  tokensPerSecond?: number;  // throughput, requires token usage
  totalChunks: number;       // total stream chunks received
  toolCallCount: number;     // number of tool calls
}
```

Timing is tracked automatically for the Data Stream runtime (via `AssistantMessageAccumulator`), `useChatRuntime` (AI SDK), and the LangGraph, AG-UI, and OpenCode runtimes. For `useLocalRuntime` and `useExternalStoreRuntime`, supply it manually.

## Supplying timing manually

Both manual runtimes read the same fields from `metadata.timing`. For `LocalRuntime`, attach it to the final `ChatModelRunResult`:

```tsx
const runtime = useLocalRuntime({
  model: {
    async run({ messages }) {
      const startTime = Date.now();
      const result = await callModel(messages);
      return {
        content: [{ type: "text", text: result.text }],
        metadata: {
          timing: {
            streamStartTime: startTime,
            totalStreamTime: Date.now() - startTime,
            tokenCount: result.usage?.completionTokens,
            totalChunks: 1,
            toolCallCount: 0,
          },
        },
      };
    },
  },
});
```

For `ExternalStoreRuntime`, put it on the `ThreadMessageLike.metadata.timing`:

```tsx
const message: ThreadMessageLike = {
  role: "assistant",
  content: [{ type: "text", text: fullText }],
  metadata: {
    timing: {
      streamStartTime,
      firstTokenTime,
      totalStreamTime,
      totalChunks,
      toolCallCount: 0,
    },
  },
};
```
