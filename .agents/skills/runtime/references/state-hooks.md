# State Hooks

Accessing assistant-ui runtime state.

## Modern API (Recommended)

### useAui

Get the runtime API for imperative actions.

```tsx
import { useAui } from "@assistant-ui/react";

function Controls() {
  const aui = useAui();

  // Thread operations (scope accessors are properties as of 0.15)
  const thread = aui.thread;
  thread.append({ role: "user", content: [{ type: "text", text: "Hi" }] });
  thread.cancelRun();
  thread.startRun({ parentId: null });

  // Message operations - selector object, not a bare index
  const message = thread.message({ index: 0 });
  message.reload();
  message.composer().beginEdit();

  // Thread list operations
  const threads = aui.threads;
  threads.switchToThread(threadId);
  threads.switchToNewThread();

  // State snapshots come from a scope, not from the client
  const state = thread.getState();
}
```

There is no `aui.getState()`. The client exposes only the scope accessors plus `subscribe(listener)` and `on(selector, callback)`; read state through `aui.<scope>.getState()` or, in React, `useAuiState`.

### useAuiState

Subscribe to state changes with a selector.

```tsx
import { useAuiState } from "@assistant-ui/react";

function MessageCount() {
  // Re-renders when messages change
  const messages = useAuiState((s) => s.thread.messages);
  return <div>{messages.length} messages</div>;
}

function RunningIndicator() {
  // Only re-renders when isRunning changes
  const isRunning = useAuiState((s) => s.thread.isRunning);
  return isRunning ? <Spinner /> : null;
}

function ComposerText() {
  const text = useAuiState((s) => s.thread.composer.text);
  return <div>Typing: {text}</div>;
}

function ThreadInfo() {
  // Multiple values
  const { messages, isRunning, capabilities } = useAuiState((s) => ({
    messages: s.thread.messages,
    isRunning: s.thread.isRunning,
    capabilities: s.thread.capabilities,
  }));
}
```

### useAuiEvent

Listen to runtime events.

```tsx
import { useAuiEvent } from "@assistant-ui/react";

function Analytics() {
  useAuiEvent("composer.send", (event) => {
    analytics.track("message_sent", {
      threadId: event.threadId,
      messageId: event.messageId, // optional, may be undefined
    });
  });

  useAuiEvent("thread.runStart", () => {
    console.log("Generation started");
  });

  useAuiEvent("thread.runEnd", () => {
    console.log("Generation completed");
  });

  return null;
}
```

Available events. Nearly all are deprecated as state-derivable: prefer observing the equivalent state with `useAuiState`, which is correct on first render and on replay, where an event handler is not.

| Event | Payload | Status |
|-------|---------|--------|
| `thread.modelContextUpdate` | `{ threadId }` | Current: model context lives in a provider, so there is no state equivalent |
| `composer.attachmentAddError` | error details | Current |
| `composer.send` | `{ threadId, messageId? }` | Deprecated: observe composer `text` clearing |
| `composer.attachmentAdd` | `{ threadId, messageId? }` | Deprecated: observe composer `attachments` |
| `thread.runStart` | `{ threadId }` | Deprecated: observe `s.thread.isRunning` flipping to `true` |
| `thread.runEnd` | `{ threadId }` | Deprecated: observe `s.thread.isRunning` flipping to `false` |
| `thread.initialize` | `{ threadId }` | Deprecated: observe `s.thread.messages` becoming non-empty |
| `threadListItem.switchedTo` | `{ threadId }` | Deprecated: compare `s.threads.mainThreadId` |
| `threadListItem.switchedAway` | `{ threadId }` | Deprecated: compare `s.threads.mainThreadId` |

## State Shape

`AssistantState` is the union of every registered scope's state, plus an `optional` view of the same scopes:

```typescript
type AssistantState = ScopeStates & {
  readonly optional: { readonly [K in keyof ScopeStates]: ScopeStates[K] | undefined };
};
```

Registered scopes: `threads`, `threadListItem`, `thread`, `message`, `part`, `composer`, `attachment`, `modelContext`, `suggestions`, `suggestion`, `chainOfThought`, `queueItem`, plus `tools`, `dataRenderers`, and `interactables` from the React layer. `on`, `optional`, and `subscribe` are reserved names and cannot be scopes.

```typescript
// s.thread
{
  isEmpty: boolean;
  isDisabled: boolean;
  isLoading: boolean;
  isRunning: boolean;
  capabilities: RuntimeCapabilities;
  messages: readonly MessageState[];
  suggestions: readonly ThreadSuggestion[];
  extras: unknown;
  speech: SpeechState | undefined;
  voice: VoiceSessionState | undefined;
  composer: ComposerState;
}

// s.threads
{
  mainThreadId: string;
  newThreadId: string | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  threadIds: readonly string[];
  archivedThreadIds: readonly string[];
  threadItems: readonly ThreadListItemState[];
  main: ThreadState;
}

// s.composer (thread composer or edit composer, depending on scope)
{
  text: string;
  role: MessageRole;
  attachments: readonly Attachment[];
  runConfig: RunConfig;
  isEditing: boolean;
  canCancel: boolean;
  canSend: boolean;
  attachmentAccept: string;
  isEmpty: boolean;
  type: "thread" | "edit";
  dictation: DictationState | undefined;
  quote: QuoteInfo | undefined;
  queue: readonly QueueItemState[];
}

// s.message = ThreadMessage & { ... }
{
  parentId: string | null;
  isLast: boolean;
  index: number;
  branchNumber: number;
  branchCount: number;
  composer: ComposerState;   // the edit composer
  parts: readonly PartState[];
  isCopied: boolean;
  isHovering: boolean;
  speech: SpeechState | undefined;
}
```

## Optional Scope Reads

`s.optional.<scope>` yields `undefined` rather than throwing when the scope is not mounted. Use it in a component that renders both inside and outside a scope:

```tsx
const partType = useAuiState((s) => s.optional.part?.type);
const inThread = useAuiState((s) => s.optional.thread != null);
```

Imperatively, the equivalent guard is `aui.<scope>.source != null`.

## Removed Legacy Hooks

The v0.12-era context hooks were **removed in 0.15**. They no longer exist as exports; importing one is a build error, not a deprecation warning.

| Removed | Replacement |
|---------|-------------|
| `useAssistantRuntime()` | `useAui()` |
| `useThreadRuntime()` | `useAui().thread` |
| `useThread(selector)` | `useAuiState((s) => s.thread)` |
| `useThreadList(selector)` | `useAuiState((s) => s.threads)` |
| `useThreadComposer(selector)` | `useAuiState((s) => s.thread.composer)` |
| `useThreadModelContext(selector)` | `useAuiState((s) => s.modelContext)` |
| `useMessageRuntime()` | `useAui().message` |
| `useMessage(selector)` | `useAuiState((s) => s.message)` |
| `useEditComposer(selector)` | `useAuiState((s) => s.message.composer)` |
| `useComposerRuntime()` | `useAui().composer` |
| `useComposer(selector)` | `useAuiState((s) => s.composer)` |
| `useMessagePartRuntime()` | `useAui().part` |
| `useMessagePart(selector)` | `useAuiState((s) => s.part)` |
| `useAttachmentRuntime()` | `useAui().attachment` |
| `useAttachment(selector)` | `useAuiState((s) => s.attachment)` |
| `useThreadListItemRuntime()` | `useAui().threadListItem` |
| `useThreadListItem(selector)` | `useAuiState((s) => s.threadListItem)` |

`useThreadMessages` was removed earlier and has no current export; use `useAuiState((s) => s.thread.messages)` (or `unstable_useThreadMessageIds()` when you only need ids and want to avoid re-rendering on content changes).

Still present but deprecated: `useMessagePartText`, `useMessagePartReasoning`, `useMessagePartSource`, `useMessagePartImage`, `useMessagePartFile`, `useMessagePartData`. Replace them by selecting and narrowing `s.part`.

## Context Requirements

```tsx
// Work anywhere inside AssistantRuntimeProvider
useAui()
useAuiState()
useAuiEvent()

// Scopes that require a surrounding provider before they resolve:
//   s.message / aui.message        - inside ThreadPrimitive.Messages
//   s.part / aui.part              - inside MessagePrimitive.Parts
//   s.attachment / aui.attachment  - inside a ComposerPrimitive.Attachments or
//                                    MessagePrimitive.Attachments render function
//   s.threadListItem               - inside ThreadListPrimitive.Items
```

Reading one of those outside its provider throws. Use `s.optional.<scope>` or `aui.<scope>.source != null` when the component can render in both places.

## Performance Tips

### Use Selectors

```tsx
// Bad - re-renders on any state change
const state = useAuiState((s) => s);

// Good - only re-renders when messages change
const messages = useAuiState((s) => s.thread.messages);

// Better - only re-renders when message count changes
const count = useAuiState((s) => s.thread.messages.length);
```

### Memoize Derived Data

```tsx
function MessageList() {
  const messages = useAuiState((s) => s.thread.messages);

  // Memoize expensive computations
  const userMessages = useMemo(
    () => messages.filter((m) => m.role === "user"),
    [messages]
  );

  return <div>{userMessages.length} user messages</div>;
}
```

### Split Components

```tsx
// Bad - entire component re-renders
function Chat() {
  const messages = useAuiState((s) => s.thread.messages);
  const isRunning = useAuiState((s) => s.thread.isRunning);
  return (
    <div>
      <MessageList messages={messages} />
      <RunningIndicator running={isRunning} />
    </div>
  );
}

// Good - components re-render independently
function Chat() {
  return (
    <div>
      <MessageList />
      <RunningIndicator />
    </div>
  );
}

function MessageList() {
  const messages = useAuiState((s) => s.thread.messages);
  return <div>...</div>;
}

function RunningIndicator() {
  const isRunning = useAuiState((s) => s.thread.isRunning);
  return isRunning ? <Spinner /> : null;
}
```

## Direct Subscription

`subscribe` and `on` live on the client itself, not on the scope accessors. Read the scope's state inside the callback:

```tsx
const aui = useAui();

useEffect(() => {
  const unsubscribe = aui.subscribe(() => {
    console.log("State changed:", aui.thread.getState());
  });

  return unsubscribe;
}, [aui]);
```

`aui.on(selector, callback)` is the imperative form of `useAuiEvent`; both take the same event selectors and return an unsubscribe function.
