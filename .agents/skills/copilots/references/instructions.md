# useAssistantInstructions

Register system instructions that guide assistant behavior from any component inside the runtime.

## Basic usage

`useAssistantInstructions` accepts a plain string. Instructions register into the model context on mount, update when the string changes, and unregister on unmount.

```tsx
import { useAssistantInstructions } from "@assistant-ui/react";

function SupportChat() {
  useAssistantInstructions("You are a customer support assistant. Be concise and cite docs.");
  return <Thread />;
}
```

## Config object

Pass an object to control registration. `disabled: true` skips registering without conditionally calling the hook.

```tsx
useAssistantInstructions({
  instruction: "You are a helpful form assistant.",
  disabled: false,
});
```

## Conditional instructions

Toggle instructions with `disabled` instead of wrapping the hook in a condition (hooks must run unconditionally).

```tsx
function ModeAwareChat({ adminMode }: { adminMode: boolean }) {
  useAssistantInstructions({
    instruction: "You may run destructive operations when the user confirms.",
    disabled: !adminMode,
  });
  return <Thread />;
}
```

## Multiline instructions

Use a template literal for structured guidance.

```tsx
function SmartForm() {
  useAssistantInstructions({
    instruction: `You are a form assistant that:
- Validates user input
- Provides helpful suggestions
- Never submits without confirmation`,
  });
  return <form></form>;
}
```

## React state in instructions

The string can interpolate component state; changing it re-registers automatically.

```tsx
function Assistant({ userName }: { userName: string }) {
  useAssistantInstructions(`Address the user as ${userName}.`);
  return <Thread />;
}
```

## Dynamic context at send-time

`useAssistantInstructions` re-registers whenever its value changes. For values that should be read fresh on every run without re-registration, use `useAssistantContext`, whose `getContext` callback is evaluated each time the model context is read and returns the system string directly.

```tsx
import { useAssistantContext } from "@assistant-ui/react";

function CartContext({ cart }: { cart: Cart }) {
  useAssistantContext({
    getContext: () => `Cart total: ${cart.total}. Items: ${cart.items.length}.`,
  });
  return null;
}
```

## Composition

Instructions are additive. When several components register instructions, the system strings are concatenated and any registered tool sets are merged, so you can colocate guidance with the feature it describes.

```tsx
function App() {
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <GlobalInstructions />  {/* "You are a helpful assistant." */}
      <CheckoutInstructions /> {/* "When checking out, confirm the address." */}
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

## With tools and visible components

Instructions pair with `makeAssistantTool` (browser tools) and `makeAssistantVisible` (component context) to describe how the assistant should use them.

```tsx
import { makeAssistantTool, useAssistantInstructions, tool } from "@assistant-ui/react";
import { z } from "zod";

const SubmitFormTool = makeAssistantTool({
  ...tool({
    parameters: z.object({ email: z.string() }),
    execute: async ({ email }) => submitForm(email),
  }),
  toolName: "submitForm",
});

function FormCopilot() {
  useAssistantInstructions("Help the user fill the form, then call submitForm.");
  return (
    <>
      <SubmitFormTool />
      <Thread />
    </>
  );
}
```

## Low-level registration

`useAssistantInstructions` is a thin wrapper over the model context API. Register `system` directly via `useAui` when you need to combine instructions, tools, and cleanup yourself.

```tsx
import { useAui } from "@assistant-ui/react";

function Provider() {
  const aui = useAui();
  useEffect(() => {
    return aui.modelContext.register({
      getModelContext: () => ({ system: "You are a search assistant." }),
    });
  }, [aui]);
  return null;
}
```

Note: the value returned from `register` is the cleanup function; call it (or return it from `useEffect`) to unregister.
