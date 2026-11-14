# Google ADK Runtime

Connect assistant-ui to Google's Agent Development Kit (ADK) via `@assistant-ui/react-google-adk`. The runtime is layered on `ExternalStoreRuntime` and normalizes ADK event fields from snake_case to camelCase (`function_call` becomes `functionCall`, `requested_tool_confirmations` becomes `requestedToolConfirmations`).

## Contents

- [Installation](#installation)
- [Server route](#server-route)
- [Client setup](#client-setup)
- [createAdkStream](#createadkstream)
- [useAdkRuntime options](#useadkruntime-options)
- [Session adapter and thread persistence](#session-adapter-and-thread-persistence)
- [Message editing](#message-editing)
- [Server helpers](#server-helpers)
- [State hooks](#state-hooks)
- [Tool confirmations](#tool-confirmations)
- [Auth credential flow](#auth-credential-flow)
- [Input requests (HITL)](#input-requests-hitl)
- [Artifacts, escalation, metadata](#artifacts-escalation-metadata)
- [Structured events](#structured-events)

## Installation

```bash
npm install @assistant-ui/react @assistant-ui/react-google-adk @google/adk
```

The client imports come from `@assistant-ui/react-google-adk`; server helpers live under the `/server` subpath. `@google/adk` is only used server-side.

## Server route

Build an ADK `LlmAgent` and `InMemoryRunner`, then expose a POST handler with `createAdkApiRoute`. Both `userId` and `sessionId` accept a static string or a `(req: Request) => string` function.

```ts
// app/api/chat/route.ts
import { createAdkApiRoute } from "@assistant-ui/react-google-adk/server";
import { InMemoryRunner, LlmAgent } from "@google/adk";

const agent = new LlmAgent({
  name: "my_agent",
  model: "gemini-2.5-flash",
  instruction: "You are a helpful assistant.",
});

const runner = new InMemoryRunner({ agent, appName: "my-app" });

export const POST = createAdkApiRoute({
  runner,
  userId: "user_1",
  sessionId: (req) => new URL(req.url).searchParams.get("sessionId") ?? "default",
});
```

## Client setup

`useAdkRuntime` takes a `stream` built with `createAdkStream`. In proxy mode the `api` option points at your own route, which forwards to ADK.

```tsx
"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useAdkRuntime, createAdkStream } from "@assistant-ui/react-google-adk";
import { Thread } from "@/components/assistant-ui/thread";

export function MyAssistant() {
  const runtime = useAdkRuntime({
    stream: createAdkStream({ api: "/api/chat" }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

## createAdkStream

Proxy mode posts to your route. Direct mode talks to an ADK server directly and requires `appName` plus `userId`.

```ts
import { createAdkStream } from "@assistant-ui/react-google-adk";

// Proxy mode: POST to your own route
const stream = createAdkStream({ api: "/api/chat" });

// Direct mode: talk to an ADK server (appName enables it; userId required)
const directStream = createAdkStream({
  api: "http://localhost:8000",
  appName: "my-app",
  userId: "user-1",
});
```

| Option | Type | Description |
| --- | --- | --- |
| `api` | `string` | URL to POST to |
| `appName` | `string?` | Enables direct mode when set |
| `userId` | `string?` | Required with `appName` |
| `headers` | `Record<string, string>` or `() => ...` | Static or dynamic headers |

## useAdkRuntime options

```ts
const runtime = useAdkRuntime({
  stream: createAdkStream({ api: "/api/chat" }),

  // Thread management: pick one approach
  sessionAdapter: adapter, // from createAdkSessionAdapter
  load, // from createAdkSessionAdapter
  // or custom callbacks:
  create: async () => ({ externalId: sessionId }),
  delete: async (externalId) => { await deleteSession(externalId); },
  // or cloud persistence:
  cloud,

  // Enables edit/regenerate (server-side forking)
  getCheckpointId: async (threadId, parentMessages) => checkpointId,

  adapters: { attachments, history, speech, feedback },

  eventHandlers: {
    onError: (error) => {},
    onAgentTransfer: (toAgent) => {},
    onCustomEvent: (key, value) => {},
  },
});
```

Pick one thread-management approach: the `sessionAdapter` + `load` pair from `createAdkSessionAdapter`, custom `create` / `load` / `delete` callbacks, or a `cloud` instance.

## Session adapter and thread persistence

`createAdkSessionAdapter` wires thread history to ADK's session REST API. It returns an `adapter` (a `RemoteThreadListAdapter`), a `load` that reconstructs messages from session events via `AdkEventAccumulator`, and `artifacts` helpers to fetch, list, and delete session artifacts.

```ts
import { createAdkSessionAdapter } from "@assistant-ui/react-google-adk";

const { adapter, load, artifacts } = createAdkSessionAdapter({
  apiUrl: ADK_URL,
  appName: "my-app",
  userId: "user-1",
});

const runtime = useAdkRuntime({
  stream: createAdkStream({ api: "/api/chat" }),
  sessionAdapter: adapter,
  load,
});
```

| Option | Type |
| --- | --- |
| `apiUrl` | `string` |
| `appName` | `string` |
| `userId` | `string` |
| `headers` | `Record<string, string>` or `() => ...` |

## Message editing

Edit and regenerate buttons only appear when you provide `getCheckpointId`. Without server-side forking the buttons stay hidden, because truncating client-side messages without forking the session would produce incorrect state.

```ts
const runtime = useAdkRuntime({
  stream: createAdkStream({ api: "/api/chat" }),
  getCheckpointId: async (threadId, parentMessages) => checkpointId,
});
```

## Server helpers

Imported from `@assistant-ui/react-google-adk/server`.

```ts
import {
  createAdkApiRoute,
  adkEventStream,
  parseAdkRequest,
  toAdkContent,
} from "@assistant-ui/react-google-adk/server";
```

`adkEventStream` converts an `AsyncGenerator<Event>` into an SSE `Response`, so you can run the agent manually instead of using `createAdkApiRoute`:

```ts
const events = runner.runAsync({ userId, sessionId, newMessage });
return adkEventStream(events);
```

`parseAdkRequest` and `toAdkContent` parse the incoming request (user messages, tool results, `stateDelta`, `checkpointId`, and multimodal content) into an ADK content payload:

```ts
const parsed = await parseAdkRequest(req);
// parsed.type is "message" or "tool-result"
// parsed.config holds runConfig and checkpointId
// parsed.stateDelta holds session state changes
const newMessage = toAdkContent(parsed);
```

## State hooks

Read ADK session, app, user, and temp state, plus agent info, from within the runtime.

```tsx
import {
  useAdkAgentInfo,
  useAdkSessionState,
  useAdkAppState,
  useAdkUserState,
  useAdkTempState,
  useAdkSend,
} from "@assistant-ui/react-google-adk";

function AgentBadge() {
  const info = useAdkAgentInfo();
  const sessionState = useAdkSessionState();
  return <span>{info?.name}</span>;
}
```

## Tool confirmations

Read pending confirmation requests with `useAdkToolConfirmations` (each item exposes `toolCallId`, `toolName`, and `hint`) and respond with `useAdkConfirmTool`.

```tsx
import {
  useAdkToolConfirmations,
  useAdkConfirmTool,
} from "@assistant-ui/react-google-adk";

function ToolConfirmations() {
  const pending = useAdkToolConfirmations();
  const confirmTool = useAdkConfirmTool();

  return pending.map((conf) => (
    <div key={conf.toolCallId}>
      <p>{conf.toolName}: {conf.hint}</p>
      <button onClick={() => confirmTool(conf.toolCallId, true)}>Allow</button>
      <button onClick={() => confirmTool(conf.toolCallId, false)}>Deny</button>
    </div>
  ));
}
```

## Auth credential flow

`useAdkAuthRequests` surfaces pending credential requests; `useAdkSubmitAuth` submits them. The `AdkAuthCredential` type covers `"apiKey"`, `"http"`, `"oauth2"`, `"openIdConnect"`, and `"serviceAccount"`.

```tsx
import {
  useAdkAuthRequests,
  useAdkSubmitAuth,
  type AdkAuthCredential,
} from "@assistant-ui/react-google-adk";

function AuthPrompt() {
  const requests = useAdkAuthRequests();
  const submitAuth = useAdkSubmitAuth();

  const credential: AdkAuthCredential = { authType: "apiKey", apiKey: "..." };
  return <button onClick={() => submitAuth(requests[0].id, credential)}>Submit</button>;
}
```

## Input requests (HITL)

`useAdkSubmitInput` answers ADK workflow input requests. Render it inside a `makeAssistantToolUI` for the `"adk_request_input"` tool. It is sugar over the generic `addResult`: `submitInput(toolCallId, value)` wraps the answer as `{ result }` for ADK's `unwrap_response`.

```tsx
import { makeAssistantToolUI } from "@assistant-ui/react";
import { useAdkSubmitInput } from "@assistant-ui/react-google-adk";

const RequestInputUI = makeAssistantToolUI({
  toolName: "adk_request_input",
  render: ({ toolCallId, args }) => {
    const submitInput = useAdkSubmitInput();
    return (
      <button onClick={() => submitInput(toolCallId, "yes")}>
        {args.prompt}
      </button>
    );
  },
});
```

## Artifacts, escalation, metadata

```tsx
import {
  useAdkArtifacts,
  useAdkEscalation,
  useAdkMessageMetadata,
} from "@assistant-ui/react-google-adk";

function Status() {
  const artifacts = useAdkArtifacts(); // Record<string, number>: filename to version
  const escalated = useAdkEscalation(); // boolean
  const metadata = useAdkMessageMetadata(); // per-message map
  // entries may include groundingMetadata, citationMetadata, usageMetadata
  return <pre>{Object.keys(artifacts).join(", ")}</pre>;
}
```

Note: `useAdkLongRunningToolIds` returns the ids of tool calls ADK is running in the background.

## Structured events

`toAdkStructuredEvents` turns a raw ADK event into typed entries; switch on `e.type` using the `AdkEventType` constants `CONTENT`, `THOUGHT`, `TOOL_CALL`, and `ERROR`.

```ts
import {
  toAdkStructuredEvents,
  AdkEventType,
} from "@assistant-ui/react-google-adk";

for (const e of toAdkStructuredEvents(event)) {
  switch (e.type) {
    case AdkEventType.CONTENT:
      break;
    case AdkEventType.THOUGHT:
      break;
    case AdkEventType.TOOL_CALL:
      break;
    case AdkEventType.ERROR:
      break;
  }
}
```
