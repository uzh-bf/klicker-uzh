# Toolkits

Declare a group of tools as a plain object and register it with `useAui({ tools: Tools({ toolkit }) })`. `Tools` is a resource, not a component.

## Contents

- [The "use generative" model](#the-use-generative-model)
- [Tool kinds](#tool-kinds)
- [Exposing a toolkit to the model](#exposing-a-toolkit-to-the-model)
- [Toolkit type](#toolkit-type)
- [ToolDefinition fields](#tooldefinition-fields)
- [Mounting with Tools](#mounting-with-tools)
- [Carrying render per tool](#carrying-render-per-tool)
- [The tool helper](#the-tool-helper)
- [mcpApp prop](#mcpapp-prop)
- [Toolkit vs component tools](#toolkit-vs-component-tools)

## The "use generative" model

The current authoring model puts a tool's schema, executor, and renderer in one file. A build plugin forks that file per target: the server build keeps the schema and backend executors, the client build keeps the schema, renderers, and browser executors. A backend `execute` never reaches the browser and a `render` never reaches the server.

Add the compiler first; the directive is inert without it:

```ts
// next.config.ts
import { withAui } from "@assistant-ui/next";
export default withAui({ /* ...your Next config... */ });
```

```ts
// vite.config.ts  (Vite / TanStack Start)
import { aui } from "@assistant-ui/vite";
export default defineConfig({ plugins: [aui()] });
```

```js
// metro.config.js  (Expo / React Native)
const { getDefaultConfig } = require("expo/metro-config");
const { withAui } = require("@assistant-ui/metro");
module.exports = withAui(getDefaultConfig(__dirname));
```

Then write the toolkit. The first line is `"use generative"` and the default export is `defineToolkit({ ... })`:

```tsx
// app/toolkit.tsx
"use generative";

import { defineToolkit } from "@assistant-ui/react";
import { z } from "zod";

export default defineToolkit({
  get_weather: {
    description: "Get current weather for a location.",
    parameters: z.object({
      location: z.string().describe("City name or zip code"),
      unit: z.enum(["celsius", "fahrenheit"]).default("celsius"),
    }),
    execute: async ({ location, unit }) => {
      "use client";
      return fetchWeatherAPI(location, unit);
    },
    render: ({ args, result }) =>
      result ? <div>{result.temperature}° {args.unit}</div> : <div>Fetching…</div>,
  },
});
```

Mount it through `useAui` and hand the client to `AssistantRuntimeProvider`:

```tsx
"use client";

import { AssistantRuntimeProvider, Tools, useAui } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import toolkit from "./toolkit";

export function MyRuntimeProvider({ children }: { children: React.ReactNode }) {
  const runtime = useChatRuntime();
  const aui = useAui({ tools: Tools({ toolkit }) });

  return (
    <AssistantRuntimeProvider aui={aui} runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
```

## Tool kinds

Inside a `"use generative"` file you never write `type`. The compiler infers the kind from `execute` and writes it back:

| `execute` you write | Inferred kind | Server build keeps | Client build keeps |
|---|---|---|---|
| plain `async () => …` | **backend** | schema + `execute` (behind `server-only`) | schema + `render` |
| `async () => { "use client"; … }` | **frontend** | schema only | schema + `execute` + `render`/`renderText` |
| `humanTool()` (alias `hitl`) | **human** | schema only | schema + `render` |
| `stubTool()` | **frontend**, executor supplied at runtime | schema only | schema + `render`/`renderText` |
| `providerTool({ … })` | **provider** | schema + provider config | schema + provider config |
| `externalTool()` | **backend**, defined elsewhere | omitted | `type: "backend"` + `render`/`renderText` |

The compiler enforces at build time that every tool declares an `execute`, that a frontend tool declares `render` or `renderText`, and that a human tool declares `render`.

```tsx
// human: pause until the user supplies a result
select_date: {
  description: "Ask the user to select a date.",
  parameters: z.object({ prompt: z.string() }),
  execute: humanTool(),
  render: ({ args, result, addResult }) =>
    result ? <p>Selected {result.date}</p>
           : <DatePicker prompt={args.prompt} onChange={(date) => addResult({ date })} />,
},

// provider: executed by the model provider
web_search: {
  execute: providerTool({
    providerId: "openai.web_search_preview",
    args: { searchContextSize: "low" },
  }),
},

// external: rendered here, executed by another system
lookup: {
  parameters: z.object({ query: z.string() }),
  execute: externalTool(),
  render: ({ args, result }) => <Results query={args.query} results={result?.results ?? []} />,
},
```

For MCP servers, spread `defineMcpToolkit({ ... })` into the toolkit instead of writing executors.

### Tool stubs

When an executor has to close over React state it cannot live in the build-split file. Declare the contract with `stubTool()` and supply the executor at runtime with `useAuiToolOverrides` from the component that owns the state:

```tsx
// app/toolkit.tsx
export default defineToolkit({
  manage_tasks: {
    description: "Add, toggle, or clear tasks on the board.",
    parameters: manageTasksParameters,
    execute: stubTool(),
    renderText: { running: "Updating tasks…", complete: "Tasks updated" },
  },
});
```

```tsx
// app/TaskBoard.tsx
import { useAuiToolOverrides } from "@assistant-ui/react";

useAuiToolOverrides({
  manage_tasks: { execute: async (args) => setTasks((t) => applyTaskAction(t, args)) },
});
```

## Exposing a toolkit to the model

The same import resolves to the server build inside a route handler. Wrap it in `AISDKToolkit` so the model receives every tool's schema:

```ts
// app/api/chat/route.ts
import { AISDKToolkit } from "@assistant-ui/react-ai-sdk";
import { streamText, convertToModelMessages, createUIMessageStreamResponse, toUIMessageStream } from "ai";
import { openai } from "@ai-sdk/openai";
import toolkit from "../../toolkit";

const aiToolkit = new AISDKToolkit({ toolkit });

export async function POST(req: Request) {
  const { messages, tools } = await req.json();

  const result = streamText({
    model: openai("gpt-5.4-nano"),
    messages: await convertToModelMessages(messages),
    tools: await aiToolkit.tools({ frontend: tools }),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
```

## Toolkit type

A `Toolkit` is a record mapping tool name to definition. Write the object literal with `satisfies Toolkit` so each entry stays strongly typed while the keys remain known tool names.

```tsx
import type { Toolkit } from "@assistant-ui/react";

type Toolkit = Record<string, ToolDefinition<any, any>>;
```

```tsx
import type { Toolkit } from "@assistant-ui/react";

const toolkit = {
  get_weather: {
    type: "frontend",
    description: "Get the weather for a city.",
    parameters: weatherSchema,
    execute: async ({ city }: { city: string }) => fetchWeather(city),
    render: WeatherToolUI,
  },
} satisfies Toolkit;
```

The object keys (`get_weather`) become the tool names the model receives and uses in tool calls.

## ToolDefinition fields

`ToolDefinition<TArgs, TResult>` carries the model-facing schema, the executor, and an optional renderer.

```tsx
interface ToolDefinition<TArgs, TResult> {
  type: "frontend";                          // browser-executed tool
  description?: string;                       // model-visible description
  parameters: StandardSchemaV1<TArgs> | JSONSchema7;
  disabled?: boolean;                         // hides the tool from the model when true
  execute?: ToolExecuteFunction<TArgs, TResult>;
  toModelOutput?: ToolModelOutputFunction<TArgs, TResult>;
  experimental_onSchemaValidationError?: OnSchemaValidationErrorFunction<TResult>;
  providerOptions?: ProviderOptions;
  display?: ToolDisplay;                       // "inline" (default) or "standalone"
  render?: ToolCallMessagePartComponent<TArgs, TResult>;
}
```

Note: `render` is required for frontend and human tools that need a UI; tools that only run logic can omit it.

## Mounting with Tools

`Tools` is a resource, not a component. Call it and pass the result to `useAui` under the `tools` scope, then hand the client to `AssistantRuntimeProvider`. Tool definitions register with model context; renderers register with the tools scope for message rendering.

```tsx
import { AssistantRuntimeProvider, Tools, useAui } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";

function App({ children }: { children: React.ReactNode }) {
  const runtime = useChatRuntime();
  const aui = useAui({ tools: Tools({ toolkit }) });

  return (
    <AssistantRuntimeProvider aui={aui} runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
```

| Option | Type | Notes |
|------|------|-------|
| `toolkit` | `Toolkit` | Tools and optional renderers to install |
| `mcpApp` | `ResourceElement<McpAppResourceOutput>` | MCP app whose tools merge into context |

## Carrying render per tool

Each definition can attach its own renderer through `render`. The component receives `args`, `result`, `status`, and `addResult`.

```tsx
import { tool } from "@assistant-ui/react";

const weatherSchema = {
  type: "object",
  properties: { city: { type: "string" } },
  required: ["city"],
} as const;

const toolkit = {
  get_weather: tool<{ city: string }, WeatherResult>({
    type: "frontend",
    description: "Get the weather for a city.",
    parameters: weatherSchema,
    execute: async ({ city }) => fetchWeather(city),
    render: ({ args, result, status }) => {
      if (status.type !== "complete") return <div>Loading {args.city}...</div>;
      return <div>{result.temperature}° in {args.city}</div>;
    },
  }),

  confirm_action: tool<{ message: string }, { confirmed: boolean }>({
    type: "frontend",
    description: "Ask the user to confirm an action.",
    parameters: {
      type: "object",
      properties: { message: { type: "string" } },
      required: ["message"],
    },
    render: ({ args, status, addResult }) => {
      if (status.type !== "requires-action") return <div>Done.</div>;
      return (
        <div>
          <p>{args.message}</p>
          <button onClick={() => addResult({ confirmed: true })}>Yes</button>
          <button onClick={() => addResult({ confirmed: false })}>No</button>
        </div>
      );
    },
  }),
} satisfies Toolkit;
```

## The tool helper

`tool` defines a single typed model tool. It accepts the same fields as a `ToolDefinition` and returns one, so it slots directly into a toolkit literal while giving you inferred `args` and `result` types inside `execute` and `render`.

```tsx
import { tool } from "@assistant-ui/react";

const getWeather = tool<{ city: string }, string>({
  type: "frontend",
  description: "Get the weather for a city.",
  parameters: {
    type: "object",
    properties: { city: { type: "string" } },
    required: ["city"],
  },
  execute: async ({ city }) => `Sunny in ${city}`,
});

const toolkit = { get_weather: getWeather } satisfies Toolkit;
```

## mcpApp option

`Tools({ mcpApp })` merges the tools of an MCP app into the same context. Build the resource element with `McpAppRenderer` and a host such as `McpAppsRemoteHost`.

```tsx
import {
  AssistantRuntimeProvider,
  Tools,
  useAui,
  McpAppRenderer,
  McpAppsRemoteHost,
} from "@assistant-ui/react";

function App({ children }: { children: React.ReactNode }) {
  const aui = useAui({
    tools: Tools({
      toolkit,
      mcpApp: McpAppRenderer({
        host: McpAppsRemoteHost({ url: "/api/mcp-apps" }),
        hostInfo: { name: "my-app", version: "1.0.0" },
        hostContext: { theme: "light" },
      }),
    }),
  });

  return (
    <AssistantRuntimeProvider aui={aui} runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
```

The renderer activates for any tool-call part whose metadata carries a `ui://`-scheme resource URI. Per-tool renderers (the `render` field on a definition) take precedence over this fallback.

## Toolkit vs component tools

Toolkits are the supported path. The component and hook APIs (`makeAssistantTool`, `useAssistantTool`, `makeAssistantToolUI`, `useAssistantToolUI`) are **deprecated** in favor of `Tools({ toolkit })`; see [the toolkit migration guide](https://assistant-ui.com/docs/migrations/toolkit-tools). For per-message UI that used to need `makeAssistantToolUI`, use the inline tool render overrides on `MessagePrimitive.Parts` instead.

Renderers registered either way land in the same scope. Reading it directly:

```tsx
const Render = useAuiState((s) => s.tools.toolUIs[toolName]?.[0]?.render);
```

`s.tools.tools` was removed in 0.15; entries in `toolUIs` carry the renderer alongside its presentation options.
