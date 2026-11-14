# Cloud Persistence

Thread and message persistence with assistant-cloud.

## Overview

Cloud persistence saves threads and messages to the assistant-ui cloud backend, enabling:
- Chat history across sessions
- Multi-device sync
- Thread management (archive, delete)
- Auto-generated titles

## Basic Setup

```tsx
import { AssistantCloud } from "assistant-cloud";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";
import { ThreadList } from "@/components/assistant-ui/thread-list";

const cloud = new AssistantCloud({
  baseUrl: process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL,
  authToken: async () => getAuthToken(),
});

function Chat() {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: "/api/chat",
    }),
    cloud,  // Enable persistence
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadList />
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

## Thread API

### List Threads

Paging is cursor based (`after`), not offset based.

```tsx
const { threads } = await cloud.threads.list({
  is_archived: false,
  limit: 50,
  after: cursor,        // id of the last thread from the previous page
});

// threads: Array<{
//   id: string;
//   title: string;
//   created_at: Date;
//   updated_at: Date;
//   last_message_at: Date;
//   is_archived: boolean;
//   external_id: string | null;
//   metadata: unknown;
//   project_id: string;
//   workspace_id: string;
// }>
```

### Get Thread

```tsx
const thread = await cloud.threads.get(threadId);
```

### Create Thread

`last_message_at` is required; everything else is optional.

```tsx
const { thread_id } = await cloud.threads.create({
  last_message_at: new Date(),   // Required
  title: "My New Chat",
  external_id: "custom-id-123",  // Optional external reference
  metadata: {                     // Optional custom data
    source: "web",
    category: "support",
  },
});
```

### Update Thread

```tsx
await cloud.threads.update(threadId, {
  title: "Updated Title",
  is_archived: true,
  metadata: { priority: "high" },
});
```

### Delete Thread

```tsx
await cloud.threads.delete(threadId);
```

## Message API

### List Messages

`messages` is a property on `cloud.threads`, and each method takes `threadId` as its first argument.

```tsx
const { messages } = await cloud.threads.messages.list(threadId, {
  format: "aui/v0",
});

// messages: Array<{
//   id: string;
//   parent_id: string | null;
//   format: "aui/v0" | string;
//   content: ReadonlyJSONObject;
//   height: number;
//   created_at: Date;
//   updated_at: Date;
// }>
```

`list` accepts only `{ format? }`; there is no paging on the message endpoint.

### Create Message

```tsx
await cloud.threads.messages.create(threadId, {
  parent_id: null,  // Or parent message ID for branching
  format: "aui/v0",
  content: {
    role: "user",
    content: [{ type: "text", text: "Hello" }],
  },
});
```

## Message Format

assistant-ui uses `"aui/v0"` format:

```typescript
interface AUIv0Message {
  role: "user" | "assistant" | "system";
  content: MessagePart[];
  status?: "running" | "complete" | "incomplete" | "requires-action";
  attachments?: Attachment[];
}

type MessagePart =
  | { type: "text"; text: string }
  | { type: "image"; image: string }
  | {
      type: "tool-call";
      toolCallId: string;
      toolName: string;
      args: unknown;
      argsText: string;
      result?: unknown;
      isError?: boolean;
      artifact?: unknown;
    }
  | { type: "reasoning"; text: string }
  | {
      type: "source";
      sourceType: "url";
      id: string;
      url: string;
      title?: string;
    };
```

## Custom Persistence Adapters

The simplest persistence is passing `cloud` to the runtime (see Basic Setup above). For full control over storage, assistant-ui exposes adapter interfaces (from `@assistant-ui/react`):

- `ThreadHistoryAdapter` owns the messages of a single thread.
- `RemoteThreadListAdapter` owns the list of threads (create, rename, archive, delete).

To back those adapters with assistant-cloud rather than your own database, use `CloudMessagePersistence` or `createFormattedPersistence` from `assistant-cloud`:

```tsx
import { CloudMessagePersistence, createFormattedPersistence } from "assistant-cloud";
```

For a database-backed example, see the custom thread persistence guide at
[assistant-ui.com/docs/integrations/persistence/custom-adapter](https://www.assistant-ui.com/docs/integrations/persistence/custom-adapter).

## Auto-Save Behavior

When `cloud` is passed to runtime:

1. **New messages** are automatically saved
2. **Thread creation** happens on first message
3. **Thread metadata** (title, timestamps) updated automatically
4. **Message branching** (edits) preserved

## Thread Title Generation

Titles are auto-generated from conversation:

```tsx
// Manual trigger
const item = api.threads.item({ id: threadId });
item.generateTitle();
```

The cloud backend uses the conversation to generate a concise title.

## External ID Mapping

Link threads to your system:

```tsx
await cloud.threads.create({
  last_message_at: new Date(),
  external_id: "your-system-id-123",
});

const { threads } = await cloud.threads.list();
const thread = threads.find(t => t.external_id === "your-system-id-123");
```

## Metadata

Store custom data with threads:

```tsx
await cloud.threads.create({
  last_message_at: new Date(),
  metadata: {
    userId: user.id,
    category: "sales",
    priority: 1,
    tags: ["important", "follow-up"],
  },
});

await cloud.threads.update(threadId, {
  metadata: { resolved: true },
});
```

## Caching and Sync

Messages are loaded on thread switch:

```tsx
// Thread list is cached in memory
// Messages loaded when switching threads
api.threads.switchToThread(threadId);
```

For real-time sync across devices, implement webhook handlers on your backend.

## Error Handling

```tsx
try {
  const threads = await cloud.threads.list();
} catch (error) {
  if (error.status === 401) {
    // Auth expired - refresh token
    await refreshAuth();
  } else if (error.status === 429) {
    // Rate limited
    await delay(1000);
  }
}
```
