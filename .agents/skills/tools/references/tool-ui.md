# makeAssistantToolUI

Render custom UI for tool calls.

> **Deprecated.** `makeAssistantToolUI` and `useAssistantToolUI` carry `@deprecated` in the source. Put `render` / `renderText` on the matching toolkit entry, or use the inline tool render overrides on `MessagePrimitive.Parts` for per-message UI. See the [toolkit migration guide](https://assistant-ui.com/docs/migrations/toolkit-tools) and [toolkits.md](./toolkits.md). This page documents the existing API for codebases that still use it.

## makeAssistantToolUI

Returns a React component that registers the tool UI renderer.

```tsx
import { makeAssistantToolUI } from "@assistant-ui/react";

const WeatherToolUI = makeAssistantToolUI({
  toolName: "get_weather",
  render: ({ args, result, status }) => {
    if (status.type === "running") {
      return <div className="animate-pulse">Loading weather...</div>;
    }

    if (result) {
      return (
        <div className="p-4 bg-blue-50 rounded-lg">
          <h3 className="font-bold">{result.city}</h3>
          <p className="text-2xl">{result.temperature}°</p>
        </div>
      );
    }

    return null;
  },
});

<AssistantRuntimeProvider runtime={runtime}>
  <WeatherToolUI />
  <Thread />
</AssistantRuntimeProvider>
```

## Render Props

The render component receives `ToolCallMessagePartProps`:

```tsx
interface ToolCallMessagePartProps {
  toolCallId: string;
  toolName: string;

  args: Record<string, unknown>;
  argsText: string;  // Raw streamed JSON string

  // Result (undefined while running)
  result?: unknown;
  isError?: boolean;
  artifact?: unknown;  // UI-only artifact attached to the result

  // Status is an OBJECT, not a string. Branch on status.type.
  status: ToolCallMessagePartStatus;

  // Supply a result from the renderer (instead of a tool execute function)
  addResult: (result: unknown) => void;
  // Resume a frontend tool paused via context.human(...)
  resume: (payload: unknown) => void;
  // Respond to a server-side approval gate
  respondToApproval: (response: { approved: boolean; reason?: string }) => void;
}

type ToolCallMessagePartStatus =
  | { type: "running" }       // Tool executing
  | { type: "complete" }      // Finished successfully
  | { type: "incomplete"; reason: "cancelled" | "length" | "content-filter" | "other" | "error" }
  | { type: "requires-action"; reason: "interrupt" };  // Waiting for input
```

## useAssistantToolUI

Hook variant for dynamic registration:

```tsx
import { useAssistantToolUI } from "@assistant-ui/react";

function DynamicToolUI({ toolConfig }) {
  useAssistantToolUI({
    toolName: toolConfig.name,
    render: ({ args, result, status }) => (
      <toolConfig.Component args={args} result={result} status={status} />
    ),
  });

  return <Thread />;
}
```

## Status Handling

```tsx
const ComprehensiveToolUI = makeAssistantToolUI({
  toolName: "process_data",
  render: ({ args, result, status }) => {
    switch (status.type) {
      case "running":
        return (
          <div className="flex items-center gap-2">
            <Spinner />
            <span>Processing {args.filename}...</span>
          </div>
        );

      case "complete":
        return (
          <div className="p-4 bg-green-50 rounded">
            <CheckIcon className="text-green-500" />
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        );

      case "incomplete":
        return (
          <div className="p-4 bg-yellow-50 rounded">
            <WarningIcon className="text-yellow-500" />
            <span>Processing was cancelled</span>
          </div>
        );

      case "requires-action":
        return (
          <div className="p-4 bg-blue-50 rounded">
            <span>Waiting for user input...</span>
          </div>
        );

      default:
        return null;
    }
  },
});
```

## Styled Components

```tsx
const SearchToolUI = makeAssistantToolUI({
  toolName: "search",
  render: ({ args, result, status }) => (
    <div className="my-4 border rounded-lg overflow-hidden">
      <div className="px-4 py-2 bg-gray-100 border-b flex items-center gap-2">
        <SearchIcon className="w-4 h-4" />
        <span className="font-medium">Search: {args.query}</span>
      </div>

      <div className="p-4">
        {status.type === "running" && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-100 animate-pulse rounded" />
            ))}
          </div>
        )}

        {status.type === "complete" && result?.results && (
          <div className="space-y-3">
            {result.results.map((item: any) => (
              <a
                key={item.url}
                href={item.url}
                className="block p-3 hover:bg-gray-50 rounded"
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="font-medium text-blue-600">{item.title}</div>
                <div className="text-sm text-gray-500 truncate">{item.url}</div>
                <div className="text-sm text-gray-700 mt-1">{item.snippet}</div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  ),
});
```

## Generative UI

For assistant-ui's declarative generative UI system (`MessagePrimitive.GenerativeUI` + the `render_gui` tool and `parseRenderGuiResult`), see [./generative-ui.md](./generative-ui.md).

You can also map a tool's result to a component yourself with `makeAssistantToolUI`. The tool name below (`render_widget`) is your own, not a built-in:

```tsx
import { Chart, Table, Form, Card } from "./components";

const componentMap: Record<string, React.ComponentType<any>> = {
  chart: Chart,
  table: Table,
  form: Form,
  card: Card,
};

const WidgetToolUI = makeAssistantToolUI({
  toolName: "render_widget",
  render: ({ args, result }) => {
    const Component = componentMap[args.type];

    if (!Component) {
      return <div>Unknown component: {args.type}</div>;
    }

    return (
      <div className="my-4">
        <Component {...args.props} data={result} />
      </div>
    );
  },
});
```

## With External State

```tsx
function ToolUIWithState() {
  const [favorites, setFavorites] = useState<string[]>([]);

  useAssistantToolUI({
    toolName: "show_products",
    render: ({ result }) => (
      <div className="grid grid-cols-3 gap-4">
        {result?.products?.map((product: any) => (
          <div key={product.id} className="border rounded p-4">
            <img src={product.image} alt={product.name} />
            <h3>{product.name}</h3>
            <button
              onClick={() => setFavorites((f) => [...f, product.id])}
              className={favorites.includes(product.id) ? "text-red-500" : ""}
            >
              ♥
            </button>
          </div>
        ))}
      </div>
    ),
  });

  return <Thread />;
}
```

## Tool Call Metadata

The render props already carry the tool call metadata (`toolCallId`, `toolName`, `status`, `args`, `result`), so no extra context hook is needed:

```tsx
const MetadataToolUI = makeAssistantToolUI({
  toolName: "process_data",
  render: ({ toolCallId, toolName, status }) => (
    <div className="text-xs text-gray-500">
      {toolName} ({toolCallId.slice(0, 8)}) - {status.type}
    </div>
  ),
});
```

## Multiple Tools

```tsx
function App() {
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <WeatherToolUI />
      <SearchToolUI />
      <ChartToolUI />
      <TableToolUI />
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```
