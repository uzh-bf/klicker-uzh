# Runtime Types

Type definitions for assistant-ui runtime system.

## Message Types

```typescript
type ThreadMessage =
  | ThreadUserMessage
  | ThreadAssistantMessage
  | ThreadSystemMessage;

interface ThreadUserMessage {
  id: string;
  role: "user";
  content: MessagePart[];
  attachments?: Attachment[];
  createdAt: Date;
}

interface ThreadAssistantMessage {
  id: string;
  role: "assistant";
  content: MessagePart[];
  status: MessageStatus;
  createdAt: Date;
}

interface ThreadSystemMessage {
  id: string;
  role: "system";
  content: MessagePart[];
  createdAt: Date;
}
```

## Message Status

`status` is an object with a `type` discriminator (not a bare string):

```typescript
type MessageStatus =
  | { type: "running" }                                    // Generation in progress
  | { type: "requires-action"; reason: "tool-calls" | "interrupt" }
  | { type: "complete"; reason: "stop" | "unknown" }       // Finished
  | {
      type: "incomplete";                                  // Stopped early
      reason: "cancelled" | "tool-calls" | "length" | "content-filter" | "other" | "error";
      error?: unknown;
    };
```

## Message Parts

```typescript
type MessagePart =
  | TextPart
  | ImagePart
  | ToolCallPart
  | ReasoningPart
  | SourcePart
  | FilePart;

interface TextPart {
  type: "text";
  text: string;
}

interface ImagePart {
  type: "image";
  image: string;
}

interface ToolCallPart {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  args: unknown;
  argsText: string;
  result?: unknown;
  isError?: boolean;
  artifact?: unknown;
}

interface ReasoningPart {
  type: "reasoning";
  text: string;
}

interface SourcePart {
  type: "source";
  sourceType: "url";
  id: string;
  url: string;
  title?: string;
}

interface FilePart {
  type: "file";
  filename?: string;
  data: string;
  mimeType: string;
}
```

## Attachment Types

```typescript
interface Attachment {
  id: string;
  type: "image" | "document" | "file";
  name: string;
  contentType?: string;
  file?: File;
  content?: AttachmentContent[];
  // Pending attachments are "requires-action"; completed ones are "complete"
  status: { type: "running" | "requires-action" | "complete" | "incomplete"; reason?: string };
}

type AttachmentContent =
  | { type: "text"; text: string }
  | { type: "image"; image: string };
```

## Runtime State Types

```typescript
interface ThreadState {
  threadId: string;
  messages: ThreadMessage[];
  isRunning: boolean;
  capabilities: ThreadCapabilities;
}

interface ThreadCapabilities {
  cancel: boolean;      // Can cancel generation
  edit: boolean;        // Can edit messages
  reload: boolean;      // Can regenerate
  copy: boolean;        // Can copy messages
  speak: boolean;       // TTS support
  attachments: boolean; // File uploads
}
```

## Thread List Types

```typescript
interface ThreadListState {
  threadIds: readonly string[];         // Active thread IDs
  archivedThreadIds: readonly string[]; // Archived thread IDs
  newThreadId: string | null; // Pending new thread ID
  mainThreadId: string;      // Current active thread
  isLoading: boolean;
  threadItems: readonly ThreadListItemState[];
}

interface ThreadListItemState {
  id: string;
  remoteId?: string;
  externalId?: string;
  title?: string;
  status: "archived" | "regular" | "new" | "deleted";
}
```

## Composer State

```typescript
interface ComposerState {
  text: string;
  role: MessageRole;            // role of the message being composed
  attachments: Attachment[];
  attachmentAccept: string;
  isEmpty: boolean;
  isEditing: boolean;           // editing an existing message
  canCancel: boolean;
  dictation?: DictationState;   // present while dictation is active
}
```

## Tool Call Types

```typescript
type ToolCallMessagePartStatus =
  | { type: "running" }        // Tool executing
  | { type: "complete" }       // Finished
  | { type: "incomplete"; reason: "cancelled" | "length" | "content-filter" | "other" | "error" }
  | { type: "requires-action"; reason: "interrupt" };  // Needs input

// Props passed to a makeAssistantToolUI render component
interface ToolCallMessagePartProps<TArgs = unknown, TResult = unknown> {
  toolCallId: string;
  toolName: string;
  args: TArgs;
  argsText: string;
  result?: TResult;
  isError?: boolean;
  artifact?: unknown;
  status: ToolCallMessagePartStatus;

  addResult: (result: unknown) => void;   // renderer-supplied result
  resume: (payload: unknown) => void;      // resume a context.human(...) tool
  respondToApproval: (response: { approved: boolean; reason?: string }) => void;
}
```

## ChatModelRunResult

Used by `useLocalRuntime` for streaming:

```typescript
interface ChatModelRunResult {
  content: MessagePart[];
}

// Yield content parts progressively:
async function* run({ messages }) {
  yield { content: [{ type: "text", text: "Hello " }] };
  yield { content: [{ type: "text", text: "world!" }] };
}
```
