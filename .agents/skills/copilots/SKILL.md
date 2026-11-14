---
name: copilots
description: "Grounding an assistant in your app with assistant-ui copilots (@assistant-ui/react). Use when steering assistant behavior with useAssistantInstructions, feeding lazy app-state context via useAssistantContext({ getContext }), exposing rendered components with makeAssistantVisible(Component, { clickable, editable }), building two-way interactable state with unstable_useInteractable / unstable_Interactables() / unstable_interactableTool (the legacy useAssistantInteractable and Interactables() are deprecated and scheduled for removal after 2026-09-14), or registering instructions and tools imperatively through useAui().modelContext.register({ getModelContext }). Reach for this when the assistant should read the current page, click or edit UI, or read and update component state through auto-generated update_{name} tools. For LLM tools and tool-call UI use the tools skill; for runtime and thread state use the runtime skill."
license: MIT
---

# assistant-ui Copilots

**Always consult [assistant-ui.com/llms.txt](https://www.assistant-ui.com/llms.txt) for the latest API.**

Copilots ground an assistant in your running app: steer it with instructions, feed it lazy app state, let it read rendered components, click and edit UI, and read or update persistent interactable state.

## References

- [./references/instructions.md](./references/instructions.md) -- useAssistantInstructions
- [./references/model-context.md](./references/model-context.md) -- useAssistantContext and imperative modelContext().register
- [./references/visible.md](./references/visible.md) -- makeAssistantVisible
- [./references/interactables.md](./references/interactables.md) -- interactable components

## Orientation

All APIs ship from `@assistant-ui/react` and run inside `AssistantRuntimeProvider`. Pick the smallest tool for the job:

```
What do you need the assistant to know or do?
├─ Steer behavior with a system prompt → useAssistantInstructions("...")
├─ Feed read-only app state (page, selection, cart) → useAssistantContext({ getContext })
├─ Let it read / click / edit a rendered component → makeAssistantVisible(Component, { clickable, editable })
├─ Read AND write persistent component state via tools → unstable_useInteractable(name, config)
└─ Register instructions + tools together imperatively → useAui().modelContext.register({ getModelContext })
```

Instructions and context are the lightweight starting point. Reach for `makeAssistantVisible` when the assistant needs to perceive or drive existing DOM, and for interactables when it needs structured two-way state it can mutate through auto-generated `update_{name}` tools.

Interactables have two generations. `unstable_useInteractable` / `unstable_Interactables()` / `unstable_interactableTool` is current. The legacy `useAssistantInteractable` / `Interactables()` / `useInteractableState` is deprecated as of 2026-06-14 and scheduled for removal on or after 2026-09-14. The two scopes are mutually exclusive in one `useAui` provider.

```tsx
import { useAssistantInstructions, useAssistantContext } from "@assistant-ui/react";

function CheckoutCopilot() {
  useAssistantInstructions("You help users complete checkout. Be concise.");
  useAssistantContext({ getContext: () => `Current page: ${window.location.href}` });
  return null;
}
```

`getContext` is evaluated fresh each time the model context is read, so it always reflects current state. Register imperatively when you need instructions and tools in one provider:

```tsx
import { useAui, tool } from "@assistant-ui/react";
import { useEffect } from "react";

function SearchCopilot() {
  const aui = useAui();
  useEffect(() => {
    return aui.modelContext.register({
      getModelContext: () => ({
        system: "You are a helpful search assistant.",
        tools: { search: mySearchTool },
      }),
    });
  }, [aui]);
  return null;
}
```

`register` returns an unsubscribe function; returning it from `useEffect` cleans up the provider on unmount. Multiple providers compose: `system` strings concatenate and `tools` maps merge.

## Common Gotchas

**Assistant ignores instructions or context**
- The hook or `register` call must run inside `AssistantRuntimeProvider`.
- For `useAui().modelContext.register`, call it in `useEffect` and return the result so it unsubscribes; registering in render leaks providers.

**Context is stale**
- Use the `getContext` callback form, not a captured value. It is re-read at send time, so closures over fresh state work; a precomputed string will not update.

**makeAssistantVisible does nothing**
- Without options the component is read-only (exposes its `outerHTML`). Pass `{ clickable: true }` to allow clicks and `{ editable: true }` for `<input>` / `<textarea>` editing. Nested visible components expose only the outermost.

**Interactable resets its state on every render**
- Define `stateSchema` and `initialState` outside the component (or memoize). A new schema each render re-registers the interactable and wipes its state. Register the scope with `useAui({ unstable_interactables: unstable_Interactables() })` (legacy: `useAui({ interactables: Interactables() })`).

**Partial updates drop fields**
- The AI sends only the fields it changes and the merge is shallow (one level deep); nested objects are replaced, not deep-merged.

## Related Skills

- **tools** -- frontend and backend tools and custom tool-call UI (`makeAssistantTool`, `useAssistantTool`, `makeAssistantToolUI`).
- **runtime** -- runtime creation, `AssistantRuntimeProvider`, and reading or mutating thread state (`useAui`, `useAuiState`, `useAuiEvent`).
