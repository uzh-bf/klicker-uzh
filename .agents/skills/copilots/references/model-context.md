# Model Context

Provide instructions, tools, and lazy app state to the assistant. Multiple providers compose: system strings concatenate, tool sets merge.

## Contents

- [useAssistantContext](#useassistantcontext) (lazy send-time string state)
- [useAssistantInstructions](#useassistantinstructions) (static instructions)
- [Imperative register](#imperative-register) (useAui().modelContext.register)
- [Provider shape](#provider-shape) (getModelContext return)
- [ModelContextRegistry](#modelcontextregistry) (standalone addTool / addInstruction / addProvider)
- [Handles](#handles) (update() and remove())
- [Composition](#composition) (how providers merge)

## useAssistantContext

`getContext` is a callback evaluated fresh each time the model context is read (at send-time), so frequently-changing app state never triggers a re-registration.

```tsx
import { useAssistantContext } from "@assistant-ui/react";

function PageContext() {
  useAssistantContext({
    getContext: () => `Current page: ${window.location.href}`,
  });
  return null;
}
```

Config shape:

```ts
interface AssistantContextConfig {
  getContext: () => string;
  disabled?: boolean; // gate registration dynamically
}
```

## useAssistantInstructions

Takes a static string (or config). Re-registers when the value changes, so prefer it for stable, explicit instructions.

```tsx
import { useAssistantInstructions } from "@assistant-ui/react";

function Setup() {
  useAssistantInstructions("You are a helpful assistant...");
  return null;
}
```

## Imperative register

`useAui().modelContext.register(provider)` returns an unsubscribe function. Register inside `useEffect` and return the result so the provider is cleaned up on unmount.

```tsx
import { useAui, tool } from "@assistant-ui/react";
import { useEffect } from "react";
import { z } from "zod";

// Define tool outside the component (no runtime dependencies)
const myTool = tool({
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    const result = await searchDatabase(query);
    return { result };
  },
});

function MyComponent() {
  const aui = useAui();
  useEffect(() => {
    return aui.modelContext.register({
      getModelContext: () => ({
        system: "You are a helpful search assistant...",
        tools: { myTool },
      }),
    });
  }, [aui]);

  return <div></div>;
}
```

Because `getModelContext` runs at send-time, you can close over changing props or state. Re-register only when the closed-over identity must change.

```tsx
function SmartHistory({ userProfile }) {
  const aui = useAui();
  useEffect(() => {
    return aui.modelContext.register({
      getModelContext: () => ({
        system: `User spending patterns:
- Average transaction: ${userProfile.avgTransaction}
- Common merchants: ${userProfile.frequentMerchants.join(", ")}`,
      }),
    });
  }, [aui, userProfile]);
  return null;
}
```

## Provider shape

A provider is `{ getModelContext, subscribe? }`. `getModelContext` returns a `ModelContext` (`system`, `tools`, `config`, ...). `subscribe` lets the runtime react to external changes without re-registering.

```ts
interface ModelContextProvider {
  getModelContext: () => ModelContext;
  subscribe?: (callback: () => void) => Unsubscribe;
}
```

Minimal provider that injects model config:

```tsx
useEffect(() => {
  const config = { config: { modelName } };
  return aui.modelContext.register({
    getModelContext: () => config,
  });
}, [aui, modelName]);
```

## ModelContextRegistry

A standalone registry instance (not tied to React) that manages tools, instructions, and nested providers. Useful outside a component tree (for example, building context in an iframe to expose to a parent assistant).

```ts
import { ModelContextRegistry } from "@assistant-ui/react";

const registry = new ModelContextRegistry();
```

Registry interface (all members optional on the type):

```ts
interface ModelContextRegistry {
  getModelContext?: () => ModelContext;
  subscribe?: (callback: () => void) => Unsubscribe;
  addTool?: (tool: AssistantToolProps) => ModelContextRegistryToolHandle;
  addInstruction?: (
    config: string | AssistantInstructionsConfig,
  ) => ModelContextRegistryInstructionHandle;
  addProvider?: (
    provider: ModelContextProvider,
  ) => ModelContextRegistryProviderHandle;
}
```

### addTool

```ts
import { z } from "zod";

const handle = registry.addTool({
  toolName: "searchProducts",
  description: "Search for products in the catalog",
  parameters: z.object({
    query: z.string(),
    category: z.string().optional(),
  }),
  execute: async ({ query, category }) => {
    const results = await searchAPI(query, category);
    return { products: results };
  },
});
```

### addInstruction

```ts
const instruction = registry.addInstruction("You are a helpful assistant.");
```

### addProvider

Compose another provider (or registry's `getModelContext`/`subscribe`) into this one.

```ts
const providerHandle = registry.addProvider({
  getModelContext: () => ({ system: "Be concise." }),
});
```

## Handles

`addTool` / `addInstruction` / `addProvider` each return a handle with `update(...)` and `remove()`. Use them to mutate or tear down a single contribution.

```ts
const toolHandle = registry.addTool({
  toolName: "convertCurrency",
  description: "Convert between currencies",
  parameters: z.object({ amount: z.number(), from: z.string(), to: z.string() }),
  execute: async ({ amount, from, to }) => {
    const rate = await fetchExchangeRate(from, to);
    return { result: amount * rate, currency: to };
  },
});

toolHandle.update({
  toolName: "convertCurrency",
  description: "Convert between currencies with live rates",
  parameters: z.object({ amount: z.number(), from: z.string(), to: z.string() }),
  execute: async ({ amount, from, to }) => {
    const rate = await fetchExchangeRate(from, to);
    return { result: amount * rate, currency: to };
  },
});

toolHandle.remove();
```

Instruction handles work the same way:

```ts
const instruction = registry.addInstruction("You are a helpful assistant.");
instruction.update("You have access to a product catalog search tool.");
instruction.remove();
```

Note: the React hooks (`useAssistantContext`, `useAssistantInstructions`) and `register()` clean up automatically. Call `handle.remove()` only when managing a `ModelContextRegistry` yourself.

## Composition

Registered providers compose rather than override:

- System instructions are concatenated.
- Tool sets are merged.
- Nested readable components only contribute their context at the outermost level.

Keep each provider focused on one component's purpose and register inside `useEffect` so removal happens on unmount.
