# Custom Persistence

Self-hosted message and thread persistence without AssistantCloud, backed by your own database through `RemoteThreadListAdapter` and `ThreadHistoryAdapter`.

## Contents

- [How the pieces fit](#how-the-pieces-fit)
- [The two adapters](#the-two-adapters)
- [withFormat, the variant useChatRuntime needs](#withformat-the-variant-usechatruntime-needs)
- [Database schema (Postgres/Drizzle)](#database-schema-postgresdrizzle)
- [Route handlers](#route-handlers)
- [Thread adapter with history](#thread-adapter-with-history)
- [Runtime provider](#runtime-provider)
- [API names](#api-names)

## How the pieces fit

Two adapters split the work. `RemoteThreadListAdapter` owns thread metadata (create, list, rename, archive, delete, generate title). `ThreadHistoryAdapter` owns the messages of a single thread (load on switch, append on each new message). You wire them together with `useRemoteThreadListRuntime`, passing `useChatRuntime` as the per-thread runtime hook.

The storage contract is four columns per message: `id`, `parent_id`, `format`, `content`. The `parent_id` chain is what preserves branching (edits and regenerations). The `format` column records which encoder produced `content` so it can be decoded back later.

Note: with `useChatRuntime` (AI SDK), the runtime always goes through `withFormat`. The top-level `load`/`append` on `ThreadHistoryAdapter` are required by the type but unused on that code path.

## The two adapters

```ts
import type {
  RemoteThreadListAdapter,
  ThreadHistoryAdapter,
} from "@assistant-ui/react";
```

`ThreadHistoryAdapter` shape:

```ts
interface ThreadHistoryAdapter {
  load: () => Promise<ExportedMessageRepository & { unstable_resume?: boolean }>;
  append: (item: ExportedMessageRepositoryItem) => Promise<void>;
  withFormat?: <TMessage, TStorageFormat extends Record<string, unknown>>(
    formatAdapter: MessageFormatAdapter<TMessage, TStorageFormat>,
  ) => GenericThreadHistoryAdapter<TMessage>;
}
```

`RemoteThreadListAdapter` shape:

```ts
interface RemoteThreadListAdapter {
  list: (params?: RemoteThreadListPageOptions) => Promise<RemoteThreadListResponse>;
  initialize: (threadId: string) => Promise<RemoteThreadInitializeResponse>;
  rename: (remoteId: string, newTitle: string) => Promise<void>;
  archive: (remoteId: string) => Promise<void>;
  unarchive: (remoteId: string) => Promise<void>;
  delete: (remoteId: string) => Promise<void>;
  fetch: (threadId: string) => Promise<RemoteThreadMetadata>;
  generateTitle: (remoteId: string, unstable_messages: readonly ThreadMessage[]) => Promise<AssistantStream>;
  unstable_Provider?: ComponentType<PropsWithChildren>;
}
```

`unstable_Provider` is the seam where you mount the per-thread `ThreadHistoryAdapter`, because that adapter needs access to the active thread's `remoteId`.

## withFormat, the variant useChatRuntime needs

`withFormat` takes a `MessageFormatAdapter` and returns a history adapter whose `load`/`append` move through the format's encode and decode. The format adapter is the bridge between a `UIMessage` and your four stored columns.

```ts
interface MessageFormatAdapter<TMessage, TStorageFormat> {
  format: string;
  encode: (item: MessageFormatItem<TMessage>) => TStorageFormat;
  decode: (stored: MessageStorageEntry<TStorageFormat>) => MessageFormatItem<TMessage>;
  getId: (message: TMessage) => string;
}
```

You do not construct this yourself; `withFormat` receives the active `fmt` and you call its methods:

- `fmt.decode({ id, parent_id, format, content })` turns a stored row back into a `UIMessage`.
- `fmt.encode(item)` turns the appended item into the `content` you store.
- `fmt.getId(item.message)` extracts the message id for the `id` column.
- `fmt.format` is the format string (for example `"ai-sdk/v6"`) you write to the `format` column.

## Database schema (Postgres/Drizzle)

`db/schema.ts`. The four message columns `id`, `parent_id`, `format`, `content` are the contract `withFormat` writes against.

```ts
import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const threads = pgTable(
  "threads",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title"),
    status: text("status", { enum: ["regular", "archived"] }).notNull().default("regular"),
    custom: jsonb("custom").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("threads_user_idx").on(t.userId)],
);

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id").notNull().references(() => threads.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    format: text("format").notNull(),
    content: jsonb("content").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("messages_thread_idx").on(t.threadId)],
);
```

## Route handlers

These back the `fetch` calls the adapters make. Every handler scopes by the authenticated user so a thread id from one user cannot read another's messages.

`app/api/threads/route.ts`:

```ts
import { db } from "@/db";
import { threads } from "@/db/schema";
import { auth } from "@/auth";
import { desc, eq } from "drizzle-orm";
import { generateId } from "ai";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response(null, { status: 401 });
  const rows = await db.select().from(threads)
    .where(eq(threads.userId, session.user.id))
    .orderBy(desc(threads.updatedAt));
  return Response.json(rows);
}

export async function POST() {
  const session = await auth();
  if (!session?.user) return new Response(null, { status: 401 });
  const id = generateId();
  await db.insert(threads).values({ id, userId: session.user.id });
  return Response.json({ id });
}
```

`app/api/threads/[id]/route.ts`:

```ts
import { db } from "@/db";
import { threads } from "@/db/schema";
import { auth } from "@/auth";
import { and, eq } from "drizzle-orm";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return new Response(null, { status: 401 });
  const patch = (await req.json()) as { title?: string; status?: "regular" | "archived" };
  await db.update(threads)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(threads.id, id), eq(threads.userId, session.user.id)));
  return new Response(null, { status: 204 });
}
```

`app/api/threads/[id]/messages/route.ts`. The POST body is exactly the `{ id, parent_id, format, content }` contract:

```ts
import { db } from "@/db";
import { threads, messages } from "@/db/schema";
import { auth } from "@/auth";
import { and, asc, eq } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return new Response(null, { status: 401 });
  const [thread] = await db.select().from(threads)
    .where(and(eq(threads.id, id), eq(threads.userId, session.user.id)));
  if (!thread) return new Response(null, { status: 404 });
  const rows = await db.select().from(messages)
    .where(eq(messages.threadId, id))
    .orderBy(asc(messages.createdAt));
  return Response.json(rows);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return new Response(null, { status: 401 });
  const body = (await req.json()) as {
    id: string;
    parent_id: string | null;
    format: string;
    content: Record<string, unknown>;
  };
  await db.insert(messages).values({
    id: body.id,
    threadId: id,
    parentId: body.parent_id,
    format: body.format,
    content: body.content,
  });
  return new Response(null, { status: 204 });
}
```

## Thread adapter with history

`app/runtime/thread-adapter.tsx`. The `RemoteThreadListAdapter` maps thread rows to and from the runtime, and its `unstable_Provider` mounts the per-thread `ThreadHistoryAdapter` through `RuntimeAdapterProvider`. The history's `withFormat` is where `fmt.encode` / `fmt.decode` run against the four columns.

```tsx
"use client";
import {
  RuntimeAdapterProvider,
  useAui,
  type RemoteThreadListAdapter,
  type ThreadHistoryAdapter,
} from "@assistant-ui/react";
import { createAssistantStream } from "assistant-stream";
import { useMemo } from "react";

export const threadListAdapter: RemoteThreadListAdapter = {
  async list() {
    const rows = await fetch("/api/threads").then((r) => r.json());
    return {
      threads: rows.map((t: any) => ({
        status: t.status,
        remoteId: t.id,
        title: t.title ?? undefined,
      })),
    };
  },
  async initialize() {
    const { id } = await fetch("/api/threads", { method: "POST" }).then((r) => r.json());
    return { remoteId: id };
  },
  async rename(remoteId, title) {
    await fetch(`/api/threads/${remoteId}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
  },
  async archive(remoteId) {
    await fetch(`/api/threads/${remoteId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "archived" }),
    });
  },
  async unarchive(remoteId) {
    await fetch(`/api/threads/${remoteId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "regular" }),
    });
  },
  async delete(remoteId) {
    await fetch(`/api/threads/${remoteId}`, { method: "DELETE" });
  },
  async fetch(remoteId) {
    const t = await fetch(`/api/threads/${remoteId}`).then((r) => r.json());
    return { status: t.status, remoteId: t.id, title: t.title };
  },
  async generateTitle(remoteId, messages) {
    return createAssistantStream(async (controller) => {
      const { title } = await fetch(`/api/threads/${remoteId}/title`, {
        method: "POST",
        body: JSON.stringify({ messages }),
      }).then((r) => r.json());
      controller.appendText(title);
    });
  },
  unstable_Provider({ children }) {
    const aui = useAui();
    const history = useMemo<ThreadHistoryAdapter>(
      () => ({
        async load() {
          return { messages: [] };
        },
        async append() {},
        withFormat: (fmt) => ({
          async load() {
            const { remoteId } = aui.threadListItem.getState();
            if (!remoteId) return { messages: [] };
            const rows = await fetch(`/api/threads/${remoteId}/messages`).then((r) => r.json());
            return {
              messages: rows.map((row: any) =>
                fmt.decode({
                  id: row.id,
                  parent_id: row.parent_id,
                  format: row.format,
                  content: row.content,
                }),
              ),
            };
          },
          async append(item) {
            const { remoteId } = await aui.threadListItem.initialize();
            await fetch(`/api/threads/${remoteId}/messages`, {
              method: "POST",
              body: JSON.stringify({
                id: fmt.getId(item.message),
                parent_id: item.parentId,
                format: fmt.format,
                content: fmt.encode(item),
              }),
            });
          },
        }),
      }),
      [aui],
    );
    return (
      <RuntimeAdapterProvider adapters={{ history }}>
        {children}
      </RuntimeAdapterProvider>
    );
  },
};
```

Note: `append` awaits `aui.threadListItem.initialize()` so the thread row exists before its first message is written; `load` uses `getState()` and bails out when there is no `remoteId` yet.

## Runtime provider

`app/runtime/MyProvider.tsx`. `useRemoteThreadListRuntime` drives the thread list, and `runtimeHook` supplies the per-thread runtime. Because the history adapter is mounted inside `unstable_Provider`, `useChatRuntime` needs no extra wiring here.

```tsx
"use client";
import {
  AssistantRuntimeProvider,
  useRemoteThreadListRuntime,
} from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { threadListAdapter } from "./thread-adapter";

export function MyProvider({ children }: { children: React.ReactNode }) {
  const runtime = useRemoteThreadListRuntime({
    runtimeHook: () => useChatRuntime(),
    adapter: threadListAdapter,
  });
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
```

## API names

| Name | Purpose |
|------|---------|
| `RemoteThreadListAdapter` | Thread metadata: list, initialize, rename, archive, unarchive, delete, fetch, generateTitle, unstable_Provider |
| `ThreadHistoryAdapter` | Per-thread messages: load, append, withFormat |
| `withFormat(fmt)` | Returns a history adapter whose load/append run through `fmt`; required by `useChatRuntime` |
| `fmt.decode({ id, parent_id, format, content })` | Stored row to `UIMessage` |
| `fmt.encode(item)` | `UIMessage` to stored `content` |
| `fmt.getId(item.message)` | Extracts the message id |
| `fmt.format` | Format string written to the `format` column (for example `"ai-sdk/v6"`) |
| `aui.threadListItem.getState()` | Reads the active thread's `remoteId` for loading |
| `aui.threadListItem.initialize()` | Awaited before appending to ensure the thread row exists |
| `useRemoteThreadListRuntime` | Combines the thread list adapter with a per-thread `runtimeHook` |
| `RuntimeAdapterProvider` | Mounts `{ history }` for the active thread |
