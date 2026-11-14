# makeAssistantTool

Create reusable tool definitions that execute in the browser.

> **Deprecated.** `makeAssistantTool` and `useAssistantTool` carry `@deprecated` in the source and point at the [toolkit migration guide](https://assistant-ui.com/docs/migrations/toolkit-tools). New tools belong in a `defineToolkit({ ... })` entry registered with `useAui({ tools: Tools({ toolkit }) })`; see [toolkits.md](./toolkits.md). This page documents the existing API for codebases that still use it.

## makeAssistantTool

Returns a React component that registers the tool when mounted.

```tsx
import { makeAssistantTool } from "@assistant-ui/react";
import { z } from "zod";

const WeatherTool = makeAssistantTool({
  toolName: "get_weather",
  parameters: z.object({
    city: z.string().describe("City name"),
    unit: z.enum(["celsius", "fahrenheit"]).optional(),
  }),
  execute: async ({ city, unit = "celsius" }) => {
    const response = await fetch(`/api/weather?city=${city}&unit=${unit}`);
    return response.json();
  },
});

function App() {
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <WeatherTool />
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

## Options

```tsx
interface MakeAssistantToolOptions<TArgs, TResult> {
  // Required
  toolName: string;
  parameters: ZodSchema<TArgs>;
  execute: (args: TArgs, context: ToolExecutionContext) => Promise<TResult>;

  // Optional
  description?: string;                     // For frontend-only tools
  disabled?: boolean;                       // Skip registering the tool
  render?: ToolCallMessagePartComponent;    // Inline tool UI for this tool
}

interface ToolExecutionContext {
  toolCallId: string;
  abortSignal: AbortSignal;
  human: (payload: unknown) => Promise<unknown>;  // Request human input (HITL)
}
```

## useAssistantTool

Hook variant for registering tools inside components.

```tsx
import { useAssistantTool } from "@assistant-ui/react";
import { z } from "zod";

function MyComponent() {
  useAssistantTool({
    toolName: "search",
    parameters: z.object({
      query: z.string(),
    }),
    execute: async ({ query }) => {
      const results = await searchAPI(query);
      return { results };
    },
  });

  return <Thread />;
}
```

## With AbortSignal

Handle cancellation:

```tsx
const LongRunningTool = makeAssistantTool({
  toolName: "analyze_data",
  parameters: z.object({ datasetId: z.string() }),
  execute: async ({ datasetId }, { abortSignal }) => {
    const response = await fetch(`/api/analyze/${datasetId}`, {
      signal: abortSignal,
    });

    if (abortSignal.aborted) {
      throw new Error("Cancelled");
    }

    return response.json();
  },
});
```

## Async Generator for Streaming

Yield partial results:

```tsx
const StreamingTool = makeAssistantTool({
  toolName: "generate_report",
  parameters: z.object({ topic: z.string() }),
  execute: async function* ({ topic }) {
    yield { status: "starting", progress: 0 };

    const outline = await generateOutline(topic);
    yield { status: "outline_complete", outline, progress: 25 };

    const content = await generateContent(outline);
    yield { status: "content_complete", content, progress: 75 };

    const formatted = await formatReport(content);
    yield { status: "complete", report: formatted, progress: 100 };
  },
});
```

## Frontend-Only Tools

Tools that run entirely in the browser:

```tsx
const CopyTool = makeAssistantTool({
  toolName: "copy_to_clipboard",
  description: "Copy text to user's clipboard",
  parameters: z.object({ text: z.string() }),
  execute: async ({ text }) => {
    await navigator.clipboard.writeText(text);
    return { success: true };
  },
});

const OpenURLTool = makeAssistantTool({
  toolName: "open_url",
  description: "Open URL in new tab",
  parameters: z.object({ url: z.string().url() }),
  execute: async ({ url }) => {
    window.open(url, "_blank");
    return { opened: true };
  },
});

const StorageTool = makeAssistantTool({
  toolName: "save_preference",
  parameters: z.object({
    key: z.string(),
    value: z.string(),
  }),
  execute: async ({ key, value }) => {
    localStorage.setItem(key, value);
    return { saved: true };
  },
});
```

## Conditional Tool Registration

```tsx
function ConditionalTools({ features }: { features: string[] }) {
  useAssistantTool({
    toolName: "premium_feature",
    parameters: z.object({ action: z.string() }),
    execute: async ({ action }) => {
      if (!features.includes("premium")) {
        throw new Error("Premium feature not available");
      }
      return performPremiumAction(action);
    },
    disabled: !features.includes("premium"),
  });

  return <Thread />;
}
```

## With React State

```tsx
function ToolWithState() {
  const [settings, setSettings] = useState({ theme: "light" });

  useAssistantTool({
    toolName: "update_settings",
    parameters: z.object({
      theme: z.enum(["light", "dark"]),
    }),
    execute: async ({ theme }) => {
      setSettings({ theme });
      return { updated: true, newTheme: theme };
    },
  });

  return (
    <div className={settings.theme}>
      <Thread />
    </div>
  );
}
```

## Multiple Tools

```tsx
function App() {
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <WeatherTool />
      <SearchTool />
      <CalculatorTool />
      <Thread />
    </AssistantRuntimeProvider>
  );
}

// Or with hook
function ToolsProvider({ children }) {
  useAssistantTool({ toolName: "weather", ... });
  useAssistantTool({ toolName: "search", ... });
  useAssistantTool({ toolName: "calculator", ... });
  return children;
}
```

## Error Handling

```tsx
const SafeTool = makeAssistantTool({
  toolName: "risky_operation",
  parameters: z.object({ input: z.string() }),
  execute: async ({ input }) => {
    try {
      const result = await riskyOperation(input);
      return { success: true, result };
    } catch (error) {
      // Return error as result (LLM can see it)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
```
