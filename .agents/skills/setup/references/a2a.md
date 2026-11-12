# A2A Protocol Integration

Connect assistant-ui to Agent-to-Agent (A2A) protocol servers via `@assistant-ui/react-a2a`.

## Installation

```bash
npm install @assistant-ui/react @assistant-ui/react-a2a
```

## Exports

```tsx
import {
  useA2ARuntime,
  useA2ATask,
  useA2AArtifacts,
  useA2AAgentCard,
  A2AClient,
  A2AError,
  // conversion utilities (advanced)
  a2aMessageToContent,
  taskStateToMessageStatus,
  contentPartsToA2AParts,
  isTerminalTaskState,
  isInterruptedTaskState,
} from "@assistant-ui/react-a2a";
```

## Basic Setup

`useA2ARuntime` connects to an A2A server by `baseUrl` (it creates a client for you) or a pre-built `client`. There is no `stream` callback.

```tsx
"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";
import { useA2ARuntime } from "@assistant-ui/react-a2a";

export function MyRuntimeProvider({ children }: { children: React.ReactNode }) {
  const runtime = useA2ARuntime({
    baseUrl: "http://localhost:9999",
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
```

## useA2ARuntime Options

```tsx
const runtime = useA2ARuntime({
  // Provide a baseUrl OR a pre-built client
  baseUrl: "https://my-agent.example.com",
  // client: new A2AClient({ baseUrl: "https://my-agent.example.com" }),

  // baseUrl-only options
  basePath: "/v1",
  tenant: "my-tenant",
  headers: { Authorization: `Bearer ${token}` },
  extensions: [],
  fetchOptions: { credentials: "include" },

  contextId: "conversation-context-id",
  configuration: {
    /* A2ASendMessageConfiguration */
  },

  onError: (error) => {},
  onCancel: () => {},
  onArtifactComplete: (artifact) => {},

  adapters: {
    attachments: attachmentAdapter,
    speech: speechAdapter,
    feedback: feedbackAdapter,
    history: historyAdapter,
  },
});
```

## Pre-built Client

```tsx
import { A2AClient } from "@assistant-ui/react-a2a";

const client = new A2AClient({ baseUrl: "https://my-agent.example.com" });
const runtime = useA2ARuntime({ client });
```

## Accessing A2A State

```tsx
import {
  useA2ATask,
  useA2AArtifacts,
  useA2AAgentCard,
} from "@assistant-ui/react-a2a";

function TaskStatus() {
  const task = useA2ATask();         // current A2A task (state + status message)
  const artifacts = useA2AArtifacts(); // accumulated artifacts
  const agentCard = useA2AAgentCard(); // agent card (capabilities/skills)

  return <div>{task?.status?.state}</div>;
}
```

## Thread Persistence

Pass a `history` or `threadList` adapter via `adapters`, or combine with the cloud thread list runtime (exported from `@assistant-ui/react`):

```tsx
import { useCloudThreadListRuntime } from "@assistant-ui/react";
```

## When to Use A2A

- Multi-agent orchestration systems
- Agents with artifact generation (files, images, etc.)
- Complex task state tracking
- Human-in-the-loop tool execution
