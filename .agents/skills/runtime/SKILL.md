---
name: runtime
description: "Guide to the assistant-ui runtime system, single-thread state, and the imperative aui client API in @assistant-ui/react. Use when creating a runtime (useLocalRuntime with a ChatModelAdapter, useExternalStoreRuntime for Redux/Zustand, useRemoteThreadListRuntime, useAssistantTransportRuntime), wiring AssistantRuntimeProvider, or reading/mutating thread, message, composer, and attachment state. Covers the unified hooks useAui, useAuiState, useAuiEvent and the v0.15 property accessors (aui.thread, aui.threads, aui.message, aui.composer, aui.part; availability via aui.thread.source != null), the s.optional.<scope> state view, scope methods (append, cancelRun, startRun, resumeRun, message({index}), part({index}), composer().send), capabilities, adapters (attachment, speech, dictation, suggestion, feedback, history), realtime voice, and types (ThreadMessage, MessageState, MessagePart, MessageStatus, ChatModelRunResult). The v0.12-era legacy context hooks (useAssistantRuntime, useThreadRuntime, useThread, useMessage, useComposer, useMessagePart, useAttachment) were removed in 0.15; route those to update. Use for provider \"Cannot read property of undefined\" errors or state not updating. For multi-thread list UI and switching between conversations use thread-list instead."
license: MIT
---

# assistant-ui Runtime

**Always consult [assistant-ui.com/llms.txt](https://www.assistant-ui.com/llms.txt) for the latest API.**

## References

- [./references/local-runtime.md](./references/local-runtime.md) -- useLocalRuntime deep dive
- [./references/external-store.md](./references/external-store.md) -- useExternalStoreRuntime deep dive
- [./references/thread-list.md](./references/thread-list.md) -- Thread list management
- [./references/state-hooks.md](./references/state-hooks.md) -- State access hooks
- [./references/types.md](./references/types.md) -- Type definitions
- [./references/adapters.md](./references/adapters.md) -- Attachment, speech, dictation, suggestion, and history adapters
- [./references/voice.md](./references/voice.md) -- Realtime voice chat
- [./references/runtime-concepts.md](./references/runtime-concepts.md) -- Stability policy, transport runtime, message timing

## Runtime Hierarchy

```
AssistantRuntime
├── ThreadListRuntime (thread management)
│   ├── ThreadListItemRuntime (per-thread item)
│   └── ...
└── ThreadRuntime (current thread)
    ├── ComposerRuntime (input state)
    └── MessageRuntime[] (per-message)
        └── MessagePartRuntime[] (per-content-part)
```

## State Access (Modern API)

```tsx
import { useAui, useAuiState, useAuiEvent } from "@assistant-ui/react";

function ChatControls() {
  const api = useAui();
  const messages = useAuiState(s => s.thread.messages);
  const isRunning = useAuiState(s => s.thread.isRunning);

  useAuiEvent("composer.send", (e) => {
    console.log("Sent in thread:", e.threadId);
  });

  return (
    <div>
      <button onClick={() => api.thread.append({
        role: "user",
        content: [{ type: "text", text: "Hello!" }],
      })}>
        Send
      </button>
      {isRunning && (
        <button onClick={() => api.thread.cancelRun()}>Cancel</button>
      )}
    </div>
  );
}
```

## Scope Accessors Are Properties

As of 0.15, `aui.<scope>` is a property, not a call. Calling it still works but is deprecated. Methods *on* a scope keep their parentheses.

```tsx
const aui = useAui();

aui.thread.getState();            // property accessor
aui.threads.switchToNewThread();
aui.thread.composer().send();     // composer() is a method of the thread scope
aui.thread.message({ index: 0 }); // selector object, not a bare index
```

Selecting an unavailable scope no longer throws; `aui.message` is always truthy. Check availability before use:

```tsx
if (aui.message.source != null) {
  aui.message.reload();
}
```

`source`, `query`, and `name` are reserved accessor properties and never resolve to scope methods.

## Thread Operations

```tsx
const aui = useAui();
const thread = aui.thread;

thread.append({ role: "user", content: [{ type: "text", text: "Hello" }] });
thread.startRun({ parentId: null });
thread.cancelRun();

const state = thread.getState();  // { messages, isRunning, capabilities, composer, ... }
```

## Message Operations

`message()` takes a selector object of `{ index }` or `{ id }`.

```tsx
const message = aui.thread.message({ index: 0 });

message.reload();
message.switchToBranch({ position: "next" });
message.submitFeedback({ type: "positive" });

// Editing goes through the message's edit composer
const editComposer = message.composer();
editComposer.beginEdit();
editComposer.setText("Updated");
editComposer.send();
```

## Events

Almost every event is now deprecated as state-derivable: derive from `useAuiState` instead of listening.

```tsx
// Preferred: derive from state
const isRunning = useAuiState((s) => s.thread.isRunning);

// Still non-deprecated
useAuiEvent("thread.modelContextUpdate", ({ threadId }) => {});
useAuiEvent("composer.attachmentAddError", (e) => {});
```

| Event | Status |
|-------|--------|
| `thread.modelContextUpdate` | Current (model context lives in a provider, not in state) |
| `composer.attachmentAddError` | Current |
| `composer.send`, `composer.attachmentAdd` | Deprecated: observe composer `text` / `attachments` |
| `thread.runStart`, `thread.runEnd` | Deprecated: observe `s.thread.isRunning` |
| `thread.initialize` | Deprecated: observe `s.thread.messages` becoming non-empty |
| `threadListItem.switchedTo`, `threadListItem.switchedAway` | Deprecated: compare `s.threads.mainThreadId` |

## Optional Scopes

`s.optional.<scope>` resolves to `undefined` instead of throwing when a scope is not mounted, which is the safe way to read a scope from a component that renders both inside and outside it:

```tsx
const partType = useAuiState((s) => s.optional.part?.type);
```

## Capabilities

```tsx
const caps = useAuiState(s => s.thread.capabilities);
```

`RuntimeCapabilities`: `switchToBranch`, `switchBranchDuringRun`, `edit`, `reload`, `delete`, `cancel`, `unstable_copy`, `speech`, `dictation`, `voice`, `attachments`, `feedback`, `queue`. Note `unstable_copy` and `speech`, not `copy` and `speak`.

Runtimes derive most of these from what you supply (a callback, an adapter) rather than from an explicit option.

## Common Gotchas

**"Cannot read property of undefined"**
- Ensure hooks are called inside `AssistantRuntimeProvider`
- For a scope that may not be mounted, read `s.optional.<scope>` or guard on `aui.<scope>.source != null`

**A legacy hook import fails to resolve**
- `useAssistantRuntime`, `useThreadRuntime`, `useThread`, `useMessage`, `useComposer`, `useMessagePart`, `useAttachment`, `useThreadListItem`, `useThreadList` and friends were removed in 0.15. See the `/update` skill for the mapping table.

**State not updating**
- Use selectors with `useAuiState` to prevent unnecessary re-renders

**Messages array empty**
- Check runtime is configured
- Verify API response format
