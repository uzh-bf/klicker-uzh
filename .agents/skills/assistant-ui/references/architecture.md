# assistant-ui Architecture

## Layered System

assistant-ui follows a 4-layer architecture where each layer depends only on layers below it.

### Layer 1: RuntimeCore (Internal)

Internal implementations that manage state:

- `LocalRuntimeCore` - In-browser state
- `ExternalStoreRuntimeCore` - External state sync
- `ThreadListRuntimeCore` - Thread management

```typescript
// Internal - not directly used
interface ThreadRuntimeCore {
  readonly messages: readonly ThreadMessage[];
  readonly isRunning: boolean;
  append(message: AppendMessage): void;
  cancelRun(): void;
  subscribe(callback: () => void): Unsubscribe;
}
```

### Layer 2: Runtime (Public API)

The object you hand to `AssistantRuntimeProvider`. `thread` and `threads` are properties:

```typescript
type AssistantRuntime = {
  readonly thread: ThreadRuntime;
  readonly threads: ThreadListRuntime;
  registerModelContextProvider(provider: ModelContextProvider): Unsubscribe;
};

type ThreadRuntime = {
  readonly path: ThreadRuntimePath;
  readonly composer: ThreadComposerRuntime;
  getState(): ThreadState;
  append(message: CreateAppendMessage): void;
  startRun(config: CreateStartRunConfig): void;
  resumeRun(config: CreateResumeRunConfig): void;
  cancelRun(): void;
  getMessageByIndex(idx: number): MessageRuntime;
  getMessageById(messageId: string): MessageRuntime;
  subscribe(callback: () => void): Unsubscribe;
};
```

### Layer 3: The aui client and hooks

`useAui()` returns an `AssistantClient`: one property accessor per registered scope, plus `subscribe` and `on`. It is the API application code should use; `AssistantRuntime` is the object that backs it.

```tsx
import { useAui, useAuiState, useAuiEvent } from "@assistant-ui/react";

const aui = useAui();

// Scope accessors are properties (0.15+); methods on a scope keep their parens
aui.thread.append({ role: "user", content: [{ type: "text", text: "Hi" }] });
aui.thread.message({ index: 0 }).reload();
aui.thread.composer().send();
aui.threads.switchToNewThread();

const messages = useAuiState((s) => s.thread.messages);

useAuiEvent("thread.modelContextUpdate", (e) => console.log(e));
```

Scopes: `threads`, `threadListItem`, `thread`, `message`, `part`, `composer`, `attachment`, `modelContext`, `suggestions`, `suggestion`, `chainOfThought`, `queueItem`, `tools`, `dataRenderers`, `interactables`.

An unavailable scope does not throw at selection time: `aui.thread` is always truthy, `source` is `null`, and any other read throws. Guard with `aui.thread.source != null`, or select through `s.optional.thread` in `useAuiState`.

### Layer 4: Primitives (UI)

Composable UI components:

```tsx
import {
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ActionBarPrimitive,
} from "@assistant-ui/react";
```

## Data Flow

```
User Action (send message)
    │
    ▼
Primitive captures event
    │
    ▼
Calls runtime API (thread.append)
    │
    ▼
RuntimeCore processes action
    │
    ▼
State updates
    │
    ▼
Subscribers notified
    │
    ▼
Primitives re-render with new state
```

## Message Model

```typescript
type ThreadMessage =
  | ThreadUserMessage
  | ThreadAssistantMessage
  | ThreadSystemMessage;

type ThreadUserMessage = {
  id: string;
  role: "user";
  content: readonly ThreadUserMessagePart[];
  attachments: readonly CompleteAttachment[];
  metadata: { custom: Record<string, unknown>; isOptimistic?: boolean };
  createdAt: Date;
};

type ThreadAssistantMessage = {
  id: string;
  role: "assistant";
  content: readonly ThreadAssistantMessagePart[];
  // status is an object, not a string. Branch on status.type.
  status: MessageStatus;
  metadata: {
    steps: readonly ThreadStep[];
    submittedFeedback?: { type: "positive" | "negative" };
    timing?: MessageTiming;
    custom: Record<string, unknown>;
    // unstable_state / unstable_annotations / unstable_data
  };
  createdAt: Date;
};

type MessageStatus =
  | { type: "running" }
  | { type: "requires-action"; reason: "interrupt" | "tool-calls" }
  | { type: "complete"; reason: "stop" | "unknown" }
  | {
      type: "incomplete";
      reason: "cancelled" | "content-filter" | "error" | "length" | "other" | "tool-calls";
      error?: ReadonlyJSONValue;
    };
```

The two roles carry different part unions:

```typescript
type ThreadUserMessagePart =
  | TextMessagePart
  | ImageMessagePart
  | FileMessagePart
  | DataMessagePart
  | Unstable_AudioMessagePart;

type ThreadAssistantMessagePart =
  | TextMessagePart          // { type: "text"; text: string }
  | ReasoningMessagePart     // { type: "reasoning"; text: string }
  | ToolCallMessagePart      // { type: "tool-call"; toolCallId; toolName; args; argsText; result?; isError?; artifact? }
  | SourceMessagePart        // { type: "source"; sourceType: "url"; id; url; title? }
  | FileMessagePart          // { type: "file"; data; mimeType; filename?; sourceType?: "id" | "url" }
  | ImageMessagePart         // { type: "image"; image: string; filename? }
  | DataMessagePart          // { type: "data"; name: string; data: T }
  | GenerativeUIMessagePart; // { type: "generative-ui"; spec: GenerativeUISpec }
```

In UI code you usually read `MessageState`, which is `ThreadMessage` plus `parentId`, `index`, `isLast`, `branchNumber`, `branchCount`, `parts` (`PartState[]`, part data plus per-part status), `composer` (the edit composer), `isCopied`, and `isHovering`.

## Branching Model

Messages form a tree structure supporting edits:

```
User: "Hello"
    └─ Assistant: "Hi there!"
       └─ User: "Tell me a joke"          ← Current branch
          └─ Assistant: "Why did..."
       └─ User: "Tell me a fact" (edit)   ← Alternative branch
          └─ Assistant: "The sun..."
```

Navigate branches with `BranchPickerPrimitive` or runtime API.
