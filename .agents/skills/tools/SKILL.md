---
name: tools
description: "Registers LLM tools and renders custom tool-call UI in assistant-ui (@assistant-ui/react). Covers the current authoring model: a \"use generative\" file exporting defineToolkit({...}) that co-locates schema, execute, and render and is split across the client/server boundary by the build plugin (withAui from @assistant-ui/next, aui() from @assistant-ui/vite, withAui from @assistant-ui/metro), mounted with Tools({ toolkit }) through useAui and exposed to the model with AISDKToolkit. Covers the tool kinds and their execute markers: backend (plain execute), frontend (\"use client\" inside execute), human via humanTool()/hitl, provider via providerTool(), external via externalTool(), stubs via stubTool() plus useAuiToolOverrides, and MCP via defineMcpToolkit. Also covers the component-scoped path (makeAssistantTool / useAssistantTool / makeAssistantToolUI / useAssistantToolUI), ToolCallMessagePartProps (status.type running/complete/incomplete/requires-action, args, argsText, result, artifact, addResult, resume, respondToApproval), server-side approval gates via the AI SDK v7 toolApproval option, generative UI from tool results, and the v0.15 s.tools.toolUIs registry. Reach for this when tool UI is not rendering, a tool is not being called, or a result is not showing."
license: MIT
---

# assistant-ui Tools

**Always consult [assistant-ui.com/llms.txt](https://www.assistant-ui.com/llms.txt) for the latest API.**

Tools let LLMs trigger actions with custom UI rendering.

## References

- [./references/make-tool.md](./references/make-tool.md) -- makeAssistantTool/useAssistantTool
- [./references/tool-ui.md](./references/tool-ui.md) -- makeAssistantToolUI rendering
- [./references/human-in-loop.md](./references/human-in-loop.md) -- Confirmation patterns
- [./references/toolkits.md](./references/toolkits.md) -- Toolkits and the Tools component
- [./references/mcp-server.md](./references/mcp-server.md) -- Server-side MCP tools
- [./references/generative-ui.md](./references/generative-ui.md) -- Declarative generative UI
- [./references/registry-components.md](./references/registry-components.md) -- ToolFallback, ToolGroup, Image renderers

## Authoring Model

Toolkits are the supported path:

```
"use generative" file exporting defineToolkit({ ... })
  → registered with useAui({ tools: Tools({ toolkit }) })
  → exposed to the model with new AISDKToolkit({ toolkit })
```

The component and hook APIs are **deprecated**: `makeAssistantTool`, `useAssistantTool`, `makeAssistantToolUI`, and `useAssistantToolUI` all carry `@deprecated` and point at [the toolkit migration guide](https://assistant-ui.com/docs/migrations/toolkit-tools). They still work, so existing code is not broken, but new tools should be toolkit entries. For per-message UI that used to need `makeAssistantToolUI`, use inline tool render overrides on `MessagePrimitive.Parts`.

See [./references/toolkits.md](./references/toolkits.md) for the full authoring guide.

## Toolkit (recommended)

One file holds the schema, the executor, and the renderer. A build plugin splits it so a backend `execute` never ships to the browser and a `render` never reaches the server.

```tsx
// app/toolkit.tsx
"use generative";

import { defineToolkit } from "@assistant-ui/react";
import { z } from "zod";

export default defineToolkit({
  get_weather: {
    description: "Get current weather for a location.",
    parameters: z.object({ location: z.string() }),
    execute: async ({ location }) => fetchWeatherAPI(location),
    render: ({ args, result }) =>
      result ? <div>{result.temperature}°</div> : <div>Fetching {args.location}…</div>,
  },
});
```

Mount it through `useAui`, and expose the same import to the model on the server:

```tsx
const runtime = useChatRuntime();
const aui = useAui({ tools: Tools({ toolkit }) });

<AssistantRuntimeProvider aui={aui} runtime={runtime}>{children}</AssistantRuntimeProvider>
```

```ts
// app/api/chat/route.ts
const aiToolkit = new AISDKToolkit({ toolkit });
const result = streamText({
  model: openai("gpt-5.4-nano"),
  messages: await convertToModelMessages(messages),
  tools: await aiToolkit.tools({ frontend: tools }),
});
```

The directive requires the compiler: `withAui()` from `@assistant-ui/next`, `aui()` from `@assistant-ui/vite`, or `withAui()` from `@assistant-ui/metro`.

## Backend Tool with UI (component model)

```ts
// Backend (app/api/chat/route.ts)
import { openai } from "@ai-sdk/openai";
import {
  streamText,
  tool,
  zodSchema,
  stepCountIs,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { z } from "zod";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openai("gpt-5.4-nano"),
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    tools: {
      get_weather: tool({
        description: "Get weather for a city",
        inputSchema: zodSchema(z.object({ city: z.string() })),
        execute: async ({ city }) => ({ temp: 22, city }),
      }),
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
```

```tsx
import { makeAssistantToolUI } from "@assistant-ui/react";

const WeatherToolUI = makeAssistantToolUI({
  toolName: "get_weather",
  render: ({ args, result, status }) => {
    // status is an object; check status.type (not status === "running")
    if (status.type === "running") return <div>Loading weather...</div>;
    return <div>{result?.city}: {result?.temp}°C</div>;
  },
});

<AssistantRuntimeProvider runtime={runtime}>
  <WeatherToolUI />
  <Thread />
</AssistantRuntimeProvider>
```

## Frontend-Only Tool

```tsx
import { makeAssistantTool } from "@assistant-ui/react";
import { z } from "zod";

const CopyTool = makeAssistantTool({
  toolName: "copy_to_clipboard",
  parameters: z.object({ text: z.string() }),
  execute: async ({ text }) => {
    await navigator.clipboard.writeText(text);
    return { success: true };
  },
});

<AssistantRuntimeProvider runtime={runtime}>
  <CopyTool />
  <Thread />
</AssistantRuntimeProvider>
```

## API Reference

```tsx
// makeAssistantToolUI render props (ToolCallMessagePartProps)
interface ToolCallMessagePartProps {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  argsText: string;          // raw streamed JSON
  result?: unknown;
  isError?: boolean;
  artifact?: unknown;        // UI-only artifact attached to the result

  // status is an OBJECT, not a string. Branch on status.type.
  status:
    | { type: "running" }
    | { type: "complete" }
    | { type: "incomplete"; reason: "cancelled" | "length" | "content-filter" | "other" | "error" }
    | { type: "requires-action"; reason: "interrupt" };

  // Supply a result from the renderer (instead of a tool execute function)
  addResult: (result: unknown | ToolResponse<unknown>) => void;
  // Resume a tool paused for human input
  resume: (payload: unknown) => void;
  // Respond to a server-side approval gate; reads the approval id off the part
  respondToApproval: (response: ToolApprovalResponse) => void;
}

// One of:
type ToolApprovalResponse =
  | { approved: boolean; reason?: string }
  | { optionId: string; reason?: string }
  | { approved: boolean; optionId: string; reason?: string };
```

Render props also carry the enriched part state, so `toolUI`, `argsText`, and the part `status` are all available without a second lookup.

## Server-Side Approval Gates

AI SDK v7 can pause a tool call server-side two ways, and they coexist: `needsApproval` on the tool definition gates that tool everywhere, and the call-level `toolApproval` option gates per call so the decision can vary by input. Either way assistant-ui surfaces the gate as `approval` on the tool part, and `respondToApproval` is the only correct way to acknowledge it.

```ts
// Backend
const result = streamText({
  model: openai("gpt-5.4-nano"),
  messages: await convertToModelMessages(messages),
  tools: { deploy: tool({ /* ... */ }) },
  toolApproval: {
    deploy: (input) =>
      input.target === "production" ? "user-approval" : "not-applicable",
  },
});
```

```tsx
// Frontend: post the decision back automatically
import { lastAssistantMessageIsCompleteWithApprovalResponses } from "ai";

const runtime = useChatRuntime({
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
});
```

```tsx
// Renderer
render: ({ args, approval, respondToApproval }) => {
  if (approval?.approved === undefined) {
    return (
      <div>
        <p>Approve deploy to {args.target}?</p>
        <button onClick={() => respondToApproval({ approved: true })}>Approve</button>
        <button onClick={() => respondToApproval({ approved: false, reason: "denied" })}>
          Deny
        </button>
      </div>
    );
  }
  return approval.approved ? <p>Approved</p> : <p>Denied</p>;
};
```

## Human-in-the-Loop

```tsx
const DeleteToolUI = makeAssistantToolUI({
  toolName: "delete_file",
  render: ({ args, status, addResult }) => {
    if (status.type === "requires-action") {
      return (
        <div>
          <p>Delete {args.path}?</p>
          <button onClick={() => addResult({ confirmed: true })}>Confirm</button>
          <button onClick={() => addResult({ confirmed: false })}>Cancel</button>
        </div>
      );
    }
    return <div>File deleted</div>;
  },
});
```

## Common Gotchas

**Tool UI not rendering**
- `toolName` must match exactly (case-sensitive); in a toolkit the object key *is* the tool name
- Register UI inside `AssistantRuntimeProvider`

**`"use generative"` file has no effect**
- The directive needs a compiler. Add `withAui()` (`@assistant-ui/next`), `aui()` (`@assistant-ui/vite`), or `withAui()` (`@assistant-ui/metro`)

**Tool not being called**
- Check tool description is clear
- Use `stopWhen: stepCountIs(n)` to allow multi-step

**Result not showing**
- Tool must return a value
- Check `status.type === "complete"` before accessing result

**Reading the tool UI registry**
- `s.tools.tools` was removed in 0.15. Select `s.tools.toolUIs[toolName]?.[0]?.render`; entries carry the renderer alongside its presentation options
