# Resumable Streams

Persist an in-flight LLM response on the server so the client can reload, drop its connection, or open a new tab and pick up the same stream. This is assistant-ui's own `assistant-stream/resumable` subpackage, not Vercel's `resumable-stream`.

## Contents

- [How it works](#how-it-works)
- [Server: the context](#server-the-context)
- [Server: POST route](#server-post-route)
- [Server: GET resume route](#server-get-resume-route)
- [Context API](#context-api)
- [Client: AssistantChatTransport](#client-assistantchattransport)
- [createResumableAssistantStreamResponse](#createresumableassistantstreamresponse)
- [Stores](#stores)
- [Redis and ioredis](#redis-and-ioredis)
- [Custom ResumableStreamStore](#custom-resumablestreamstore)
- [Production notes](#production-notes)
- [Exports](#exports)

## How it works

Persistence happens at the byte level after encoding, so it works with any encoder that ships in `assistant-stream` (AI SDK UI message stream, data stream, assistant transport SSE, or your own). The first request becomes the producer and writes encoded bytes to a store while the LLM call is in flight; reconnects become consumers that replay the persisted bytes plus any new ones until the producer finalizes. Streams are addressed by an opaque `streamId`.

## Server: the context

Construct a `ResumableStreamContext` once per process and reuse it across requests. It is the seam between route handlers and the storage backend.

```ts
// /lib/resumable-context.ts
import {
  createInMemoryResumableStreamStore,
  createResumableStreamContext,
} from "assistant-stream/resumable";

const store = createInMemoryResumableStreamStore();
export const resumableContext = createResumableStreamContext({ store });
```

Options on `createResumableStreamContext`:

- `store`: a `ResumableStreamStore` implementation (required).
- `waitUntil`: pass `after` from `next/server` (or your platform's `ctx.waitUntil`) so the producer task survives past the response on serverless.
- `ttlMs`: per-deployment TTL override.
- `onAcquire`, `onAppend`, `onFinalize`, `onError`: observability hooks.

## Server: POST route

Wrap the response body in `ctx.run(streamId, makeStream)`. The first caller for `streamId` becomes the producer (the callback runs); later callers and reconnects become consumers. Set the stream id on the response header so the client can find it.

```ts
// /app/api/chat/route.ts
import {
  streamText,
  createUIMessageStreamResponse,
  toUIMessageStream,
} from "ai";
import { RESUMABLE_STREAM_ID_HEADER } from "assistant-stream/resumable";
import { resumableContext } from "@/lib/resumable-context";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const streamId = crypto.randomUUID();

  const result = streamText({ /* model, messages, tools, ... */ });
  const sourceBody = createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  }).body!;

  const stream = await resumableContext.run(streamId, () => sourceBody);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      [RESUMABLE_STREAM_ID_HEADER]: streamId,
    },
  });
}
```

`RESUMABLE_STREAM_ID_HEADER` is the string `"x-resumable-stream-id"`.

## Server: GET resume route

A separate GET endpoint replays persisted bytes for reconnecting clients. `ctx.resume(streamId)` returns `null` when no stream exists.

```ts
// /app/api/chat/resume/[streamId]/route.ts
import { RESUMABLE_STREAM_ID_HEADER } from "assistant-stream/resumable";
import { resumableContext } from "@/lib/resumable-context";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ streamId: string }> },
) {
  const { streamId } = await ctx.params;
  const stream = await resumableContext.resume(streamId);
  if (!stream) {
    return new Response(JSON.stringify({ error: "stream not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      [RESUMABLE_STREAM_ID_HEADER]: streamId,
    },
  });
}
```

## Context API

| Method | Behavior |
| --- | --- |
| `ctx.run(streamId, makeStream)` | First caller is the producer (runs `makeStream`); reconnects become consumers. |
| `ctx.resume(streamId)` | Returns a replay stream, or `null` if the stream is missing. |
| `ctx.requireResume(streamId)` | Like `resume`, but throws `ResumableStreamError` with code `"missing"` when absent. |
| `ctx.status(streamId)` | Returns `"streaming" \| "done" \| "error" \| "missing"`. |
| `ctx.delete(streamId)` | Removes all persisted state and terminates active readers. |

`ResumableStreamError` is exported from `assistant-stream/resumable` with codes `"missing" | "exists" | "finalized" | "invalid-id"`. Catch it in the resume route to distinguish "stream gone" from other failures.

## Client: AssistantChatTransport

`@assistant-ui/react-ai-sdk` ships a `resumable` option on `AssistantChatTransport`. It captures the stream id from the response header, redirects `chat.resumeStream()` reconnects to your resume route, and clears the stored id when the response finishes naturally. `useChatRuntime` fires `chat.resumeStream()` on mount whenever a pending id is present in storage.

```tsx
// /app/page.tsx
"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  AssistantChatTransport,
  createResumableSessionStorage,
  useChatRuntime,
} from "@assistant-ui/react-ai-sdk";
import { useMemo } from "react";
import { Thread } from "@/components/assistant-ui/thread";

const storage = createResumableSessionStorage();

export default function Page() {
  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: "/api/chat",
        resumable: {
          storage,
          resumeApi: (streamId) => `/api/chat/resume/${streamId}`,
        },
      }),
    [],
  );
  const runtime = useChatRuntime({ transport });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

`createResumableSessionStorage` returns a `ResumableClientStorage` backed by `window.sessionStorage`. Pass `{ key }` to namespace per route or per chat surface, or supply your own object implementing `getStreamId`, `setStreamId`, and `clear`.

The default finish detector scans the SSE body for the AI SDK `"type":"finish"` marker. Override `isFinishEvent` on the `resumable` option when you ship a custom encoder.

## createResumableAssistantStreamResponse

If you produce streams via `createAssistantStream` rather than the AI SDK, two helpers bridge the controller-callback style and any encoder to the store. They set the `x-resumable-stream-id` header automatically.

```ts
import {
  createResumableAssistantStreamResponse,
  createResumeAssistantStreamResponse,
} from "assistant-stream/resumable";
import { resumableContext } from "@/lib/resumable-context";

// POST handler
return createResumableAssistantStreamResponse({
  context: resumableContext,
  streamId,
  callback: (controller) => {
    /* same shape as createAssistantStreamResponse */
  },
});

// GET resume handler
return createResumeAssistantStreamResponse({
  context: resumableContext,
  streamId,
});
```

Both default to the data-stream encoder; pass `encoder: () => new AssistantTransportEncoder()` (or any custom encoder) to override.

## Stores

`createInMemoryResumableStreamStore` is for development and tests. State lives in a process-local `Map`, so it does not survive a server restart. Options:

- `defaultTtlMs`: TTL after the last write (built-in default is 24 hours).
- `maxChunkBytes`: cap on a single appended chunk.
- `maxEntriesPerStream`: cap on entries retained per stream.
- `maxStreams`: cap on concurrently tracked streams.
- `gcIntervalMs`: interval for periodic eviction.

## Redis and ioredis

For production, use the optional Redis adapters via `assistant-stream/resumable/redis` (node-redis v5) or `assistant-stream/resumable/ioredis`. Both batch the per-append write and TTL refresh into a single pipelined round trip, store chunk values as binary, and accept the same `keyPrefix`, `defaultTtlMs`, `pollIntervalMs`, and `maxChunkBytes` options. Cluster routing works because each stream's keys share a `{streamId}` hash tag.

```ts
// /lib/resumable-context.ts
import {
  createResumableStreamContext,
  type ResumableStreamStore,
} from "assistant-stream/resumable";

async function createStore(): Promise<ResumableStreamStore> {
  if (!process.env.REDIS_URL) {
    const { createInMemoryResumableStreamStore } = await import(
      "assistant-stream/resumable"
    );
    return createInMemoryResumableStreamStore();
  }
  const { createClient } = await import("redis");
  const { createRedisResumableStreamStore } = await import(
    "assistant-stream/resumable/redis"
  );
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  return createRedisResumableStreamStore(client);
}

export const resumableContext = createResumableStreamContext({
  store: await createStore(),
});
```

The ioredis sub-path exposes `createIoredisResumableStreamStore` with the same shape. The Redis adapters validate `streamId` against `/^[A-Za-z0-9_.:-]{1,256}$/`; UUIDv4 is compatible.

## Custom ResumableStreamStore

For Postgres, Cloudflare Durable Objects, Upstash REST, or any backend you operate, implement `ResumableStreamStore` directly. It is six async methods over an opaque `streamId` and a monotonic byte log.

```ts
import type { ResumableStreamStore } from "assistant-stream/resumable";

export interface ResumableStreamStore {
  acquire(
    streamId: string,
    options?: ResumableStreamAcquireOptions,
  ): Promise<ResumableStreamRole>;
  append(streamId: string, chunk: Uint8Array): Promise<void>;
  finalize(
    streamId: string,
    status: "done" | "error",
    error?: string,
  ): Promise<void>;
  read(
    streamId: string,
    cursor: string,
    signal: AbortSignal,
  ): AsyncIterable<ResumableStreamEntry>;
  status(streamId: string): Promise<ResumableStreamStatus>;
  delete(streamId: string): Promise<void>;
}
```

Contract:

- `acquire` arbitrates ownership. The first caller resolves to `"producer"`, every later caller (including after `finalize`) to `"consumer"`. The check and insert must be atomic: Redis `SET key value NX EX ttl`; Postgres `INSERT ... ON CONFLICT (stream_id) DO NOTHING RETURNING ...`; Durable Objects one object per `streamId` plus a boolean; Upstash REST `set` with `nx=true`. `options.ttlMs` overrides the store default for this stream.
- `append` adds a chunk under a fresh monotonically increasing cursor, observable to `read` before the promise resolves; refresh the TTL and reject when missing or finalized.
- `finalize` is an idempotent terminal flip; a duplicate call with the same status is a no-op.
- `read` yields every entry whose cursor sorts strictly after `cursor`, then waits for new appends, then completes on finalize. Cursor `""` means start from the beginning. Aborting `signal` resolves the iterable cleanly without throwing; do not busy-loop.
- `status` returns `"streaming" | "done" | "error" | "missing"`.
- `delete` removes all state, no-ops when missing, and terminates active `read` iterables.

Cursors are opaque strings the store assigns and the context echoes back; they must be strictly monotonic per stream (sequence number, ULID, `bigserial`, Redis stream id are all fine). Cross-stream ordering is not required. Wire any conforming instance in as `store`:

```ts
// /lib/resumable-context.ts
import { createResumableStreamContext } from "assistant-stream/resumable";
import { createMapResumableStreamStore } from "@/lib/map-resumable-store";

export const resumableContext = createResumableStreamContext({
  store: createMapResumableStreamStore(),
});
```

Note: a full `Map`-backed worked example lives in the [Custom Resumable Stream Stores](https://www.assistant-ui.com/docs/guides/resumable-stream-stores) guide.

## Production notes

- Auth. The resume route serves any caller that knows the stream id. Bind `streamId` to the requesting user at acquire time and verify the binding in the resume handler. Treat the id as opaque, not a credential; it leaks via response headers, `sessionStorage`, browser history, and access logs.
- `waitUntil` on serverless. On Vercel and Cloudflare the handler is killed once the response returns, interrupting the producer. Pass `createResumableStreamContext({ store, waitUntil: after })` with `after` from `next/server`.
- TTL. Streams expire 24 hours after the last write by default. Configure with `defaultTtlMs` on the store or `ttlMs` on the context. When a stream expires, treat it like `finalize(streamId, "error", "Stream expired")`. Match TTLs across the store, any owner-binding key, and any signed cookie referencing a `streamId`.
- Scaffold the runnable example with `npx assistant-ui create my-app -e with-resumable-stream`.

## Exports

`assistant-stream/resumable`:

- `createResumableStreamContext`, type `ResumableStreamContext`, type `ResumableStreamContextOptions`
- `createInMemoryResumableStreamStore`, type `InMemoryResumableStreamStoreOptions`
- `createResumableAssistantStreamResponse`, `createResumeAssistantStreamResponse`, `RESUMABLE_STREAM_ID_HEADER`
- `ResumableStreamError`, type `ResumableStreamErrorCode`
- types `ResumableStreamStore`, `ResumableStreamRole`, `ResumableStreamStatus`, `ResumableStreamEntry`, `ResumableStreamAcquireOptions`
- types `RedisLikeClient`, `RedisResumableStreamStoreOptions`

`assistant-stream/resumable/redis`: `createRedisResumableStreamStore`. `assistant-stream/resumable/ioredis`: `createIoredisResumableStreamStore`.

`@assistant-ui/react-ai-sdk`: `AssistantChatTransport` (with the `resumable` option), `createResumableSessionStorage`, `useChatRuntime`.
