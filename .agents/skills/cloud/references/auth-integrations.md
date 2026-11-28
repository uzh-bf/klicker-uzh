# Auth Integrations

Auth provider patterns beyond the bare JWT snippet: better-auth and full server-side Clerk, including 401 gating, per-user and per-org scoping, and reloading the thread list on auth transitions.

## Contents

- [Scope](#scope)
- [better-auth: mount the handler](#better-auth-mount-the-handler)
- [better-auth: gate the chat route](#better-auth-gate-the-chat-route)
- [better-auth: scope threads by user.id](#better-auth-scope-threads-by-userid)
- [better-auth: React client](#better-auth-react-client)
- [better-auth: reload threads on auth](#better-auth-reload-threads-on-auth)
- [Clerk: gate the chat route](#clerk-gate-the-chat-route)
- [Clerk: per-user thread scoping](#clerk-per-user-thread-scoping)
- [Clerk: per-org scoping](#clerk-per-org-scoping)
- [Clerk: ReloadOnAuth](#clerk-reloadonauth)
- [Pairing AssistantCloud with a backend token endpoint](#pairing-assistantcloud-with-a-backend-token-endpoint)
- [Verify](#verify)

## Scope

Two paths exist for auth. With AssistantCloud, the cloud handles the JWT exchange and gives you workspace-scoped threads with no DB code (see [authorization.md](./authorization.md) for the `authToken` client snippet and direct provider integration). Without AssistantCloud, you gate your own routes and scope queries against the signed-in user's id, pairing with [custom thread persistence](./custom-persistence.md). The sections below cover the non-cloud path for better-auth and Clerk, then show how to pair AssistantCloud with a backend token endpoint when you need custom workspace logic.

## better-auth: mount the handler

better-auth owns the session, user table, and cookie. Its catch-all handler must be wired so sign-in, sign-out, and session refresh have somewhere to land.

```ts title="app/api/auth/[...all]/route.ts"
import { auth } from "@/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

## better-auth: gate the chat route

Resolve the session server-side with `auth.api.getSession`. It takes the request headers (which carry the session cookie) and returns `null` for unauthenticated callers. Return 401 before calling the model so unauthenticated traffic does not burn provider credits.

```ts title="app/api/chat/route.ts"
import { auth } from "@/auth";
import { headers } from "next/headers";
import { openai } from "@ai-sdk/openai";
import {
  streamText,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
} from "ai";
import type { UIMessage } from "ai";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { messages }: { messages: UIMessage[] } = await req.json();
  const result = streamText({
    model: openai("gpt-5.4-nano"),
    messages: await convertToModelMessages(messages),
  });
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
```

`headers()` from `next/headers` returns the active request's headers in App Router route handlers; always `await` it.

## better-auth: scope threads by user.id

With custom thread persistence, every thread endpoint filters by `session.user.id`. The `id` field comes from the user row better-auth manages, so no callback configuration is needed.

```ts title="app/api/threads/route.ts"
import { auth } from "@/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { threads } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response(null, { status: 401 });

  const rows = await db
    .select()
    .from(threads)
    .where(eq(threads.userId, session.user.id))
    .orderBy(desc(threads.updatedAt));

  return Response.json(rows);
}
```

If better-auth's user schema and your threads table share a database, a foreign key from `threads` to `user.id` keeps deletes consistent.

## better-auth: React client

Create the client once and import it from a shared module so all hooks share state.

```ts title="lib/auth-client.ts"
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();
```

## better-auth: reload threads on auth

`useSession` from the React client tracks the live session. The first render may run before the session resolves, so drop a small effect inside `<AssistantRuntimeProvider>` that reloads the thread list once the user is signed in.

```tsx title="app/components/ReloadOnAuth.tsx"
"use client";

import { useAui } from "@assistant-ui/react";
import { authClient } from "@/lib/auth-client";
import { useEffect } from "react";

export function ReloadOnAuth() {
  const aui = useAui();
  const { data: session, isPending } = authClient.useSession();
  useEffect(() => {
    if (!isPending && session) aui.threads.reload();
  }, [isPending, session?.user?.id]);
  return null;
}
```

Mount it anywhere inside your `<AssistantRuntimeProvider>` subtree (typically next to the runtime provider in `MyProvider`). `reload()` discards in-flight responses from superseded calls, so it is safe to invoke on every auth transition.

## Clerk: gate the chat route

Clerk's `auth()` from `@clerk/nextjs/server` runs in any Next.js server context (server components, route handlers, server actions) and returns `userId` directly. Return 401 before calling the model. This does not reproduce `clerkMiddleware`; the guide assumes `<ClerkProvider>` and `clerkMiddleware()` are already in place.

```ts title="app/api/chat/route.ts"
import { auth } from "@clerk/nextjs/server";
import { openai } from "@ai-sdk/openai";
import {
  streamText,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
} from "ai";
import type { UIMessage } from "ai";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { messages }: { messages: UIMessage[] } = await req.json();
  const result = streamText({
    model: openai("gpt-5.4-nano"),
    messages: await convertToModelMessages(messages),
  });
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
```

## Clerk: per-user thread scoping

With custom thread persistence, every thread-list endpoint filters by `userId`. Without scoping, any signed-in user can list everyone's threads.

```ts title="app/api/threads/route.ts"
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { threads } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response(null, { status: 401 });

  const rows = await db
    .select()
    .from(threads)
    .where(eq(threads.userId, userId))
    .orderBy(desc(threads.updatedAt));

  return Response.json(rows);
}
```

## Clerk: per-org scoping

For organization-scoped threads (Clerk Orgs), pull `orgId` from `auth()` and add it to the where clause. The `orgId` plus `userId` combination is a stable workspace key.

```ts
import { and, eq } from "drizzle-orm";

const { userId, orgId } = await auth();
if (!userId) return new Response(null, { status: 401 });

const rows = await db
  .select()
  .from(threads)
  .where(
    orgId
      ? and(eq(threads.orgId, orgId), eq(threads.userId, userId))
      : eq(threads.userId, userId),
  );
```

Surface Clerk's `<OrganizationSwitcher>` (from `@clerk/nextjs`) and re-fetch threads on org change.

## Clerk: ReloadOnAuth

The first render of `<MyProvider>` may run before Clerk resolves the user on the client. `useUser` from `@clerk/nextjs` exposes that state; reload once the user is loaded and signed in.

```tsx title="app/components/ReloadOnAuth.tsx"
"use client";

import { useAui } from "@assistant-ui/react";
import { useUser } from "@clerk/nextjs";
import { useEffect } from "react";

export function ReloadOnAuth() {
  const aui = useAui();
  const { isLoaded, isSignedIn, user } = useUser();
  useEffect(() => {
    if (isLoaded && isSignedIn) aui.threads.reload();
  }, [isLoaded, isSignedIn, user?.id]);
  return null;
}
```

Mount it inside your `<AssistantRuntimeProvider>` subtree. Because `reload()` discards superseded in-flight responses, it is safe on every transition including sign in, sign out, and organization switch.

## Pairing AssistantCloud with a backend token endpoint

When you want Cloud-managed threads but custom workspace logic (for example, to derive the workspace from better-auth's `session.user.id` or from Clerk's `orgId`), use the backend token endpoint instead of a direct provider integration. Resolve the user server-side, compute a `workspaceId`, mint a token with the server-side client from `assistant-cloud`, and return it.

```ts title="app/api/assistant-ui-token/route.ts"
import { AssistantCloud } from "assistant-cloud";
import { auth } from "@clerk/nextjs/server"; // or auth.api.getSession for better-auth

export const POST = async (req: Request) => {
  const { userId, orgId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const workspaceId = orgId ? `${orgId}_${userId}` : userId;

  const assistantCloud = new AssistantCloud({
    apiKey: process.env.ASSISTANT_API_KEY!,
    userId,
    workspaceId,
  });

  const { token } = await assistantCloud.auth.tokens.create();
  return new Response(token);
};
```

The frontend client (from `@assistant-ui/react`) fetches that endpoint and returns the body as its `authToken`.

```tsx title="app/chat/page.tsx"
import { AssistantCloud } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";

const cloud = new AssistantCloud({
  baseUrl: process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL!,
  authToken: () =>
    fetch("/api/assistant-ui-token", { method: "POST" }).then((r) => r.text()),
});

const runtime = useChatRuntime({ cloud });
```

For better-auth, swap the `auth()` call for `await auth.api.getSession({ headers: await headers() })` and read `session.user.id`. Personal chats use `userId` as the workspace; org or project apps combine ids (`orgId_userId`, `projectId_userId`).

## Verify

Sign in, then check:

- `/api/chat` returns `200` when authenticated and `401` when not.
- `/api/threads` returns only the current user's threads.
- A second user (incognito tab, different account) sees a different thread list.
- For Clerk Orgs, switching the active organization in `<OrganizationSwitcher>` triggers a reload when `orgId` is wired into the where clause.
- The session cookie travels with same-origin fetches. If you split the API onto another host, set `credentials: "include"` and configure CORS.
