# Interactables

Persistent UI components whose state the AI can read and update through auto-generated tools.

> **Two generations of this API exist.** The legacy one (`Interactables()`, `useAssistantInteractable`, `useInteractableState`) is deprecated as of 2026-06-14 and scheduled for removal on or after 2026-09-14. The current one is the `unstable_` family (`unstable_Interactables()`, `unstable_useInteractable`, `unstable_interactableTool`); it is marked unstable and may change in any release. The two scopes are **mutually exclusive**: mount only one per `useAui` provider. Write new code against the `unstable_` API; the rest of this page documents the legacy API for codebases still on it.

## Contents

- [Current API (unstable_)](#current-api-unstable_)
- [Overview](#overview)
- [Register the scope](#register-the-scope)
- [useAssistantInteractable](#useassistantinteractable)
- [useInteractableState](#useinteractablestate)
- [Auto-generated update tools](#auto-generated-update-tools)
- [Multiple instances](#multiple-instances)
- [Selection](#selection)
- [Streaming updates](#streaming-updates)
- [Persistence](#persistence)
- [Export and import](#export-and-import)
- [Schema evolution](#schema-evolution)

## Current API (unstable_)

Two shapes, depending on where the interactable lives.

**App-scoped**: a component you mount anywhere. `unstable_useInteractable(name, config)` returns `[state, controls]`, where controls carry `id`, `version`, `setState`, `isPending`, `error`, and `flush`. State is shared across every thread and survives a reload only with a persistence adapter.

```tsx
import { unstable_useInteractable } from "@assistant-ui/react";
import { z } from "zod";

const taskBoardSchema = z.object({
  tasks: z.array(z.object({ id: z.string(), title: z.string(), done: z.boolean() })),
});

function TaskBoard() {
  const [state, { setState }] = unstable_useInteractable("taskBoard", {
    description:
      "A task board panel that lists tasks. Use update_taskBoard with tasks.add/update/remove/clear.",
    stateSchema: taskBoardSchema,
    initialState: { tasks: [] },
  });

  return (
    <ul>
      {state.tasks.map((task) => (
        <li key={task.id}>
          <input
            type="checkbox"
            checked={task.done}
            onChange={() =>
              setState((prev) => ({
                tasks: prev.tasks.map((t) =>
                  t.id === task.id ? { ...t, done: !t.done } : t,
                ),
              }))
            }
          />
          {task.title}
        </li>
      ))}
    </ul>
  );
}
```

**Thread-scoped**: an interactable tool UI the model calls in-thread. Define it with `unstable_interactableTool` inside `defineToolkit`; its state rides the thread history, so it survives a reload with nothing extra to persist.

```tsx
"use generative";

import { defineToolkit, unstable_interactableTool } from "@assistant-ui/react";
import { z } from "zod";

const toolkit = defineToolkit({
  notepad: unstable_interactableTool({
    description: "A notepad with drafted text the user can read and edit.",
    stateSchema: z.object({ title: z.string(), content: z.string() }),
    render: ({ state, setState, version, streaming }) => (
      <Notepad
        value={state}
        onChange={setState}
        busy={streaming}
        readOnly={version ? !version.isLatest : false}
      />
    ),
  }),
});
```

Register the scope (and the toolkit, for the thread-scoped form):

```tsx
import { Tools, unstable_Interactables, useAui } from "@assistant-ui/react";

const aui = useAui({
  unstable_interactables: unstable_Interactables(),
  tools: Tools({ toolkit }),
});
```

On an AI SDK backend, `convertToModelMessages` drops message metadata, so interactable snapshots need to be injected explicitly:

```ts
import { unstable_injectInteractableContext } from "@assistant-ui/react-ai-sdk";

const result = streamText({
  model: openai("gpt-5.4"),
  messages: await convertToModelMessages(unstable_injectInteractableContext(messages)),
});
```

Related exports: `unstable_useInteractableState(id)`, `unstable_useInteractableVersions(id, name)`, `unstable_getInteractableSnapshots`, `unstable_getInteractableVersions`, `unstable_formatInteractableSnapshot`.

## Overview

An interactable is a React component with state that is shared between the user and the AI. State persists across messages, supports partial updates, and the framework auto-registers a tool so the model can change it. Unlike a tool UI (which only renders a tool call), an interactable lives anywhere in your app and stays mounted across turns.

Everything below documents the **legacy** API. All of it comes from `@assistant-ui/react`.

```tsx
import {
  useAui,
  useAuiState,
  Interactables,
  AssistantRuntimeProvider,
  useAssistantInteractable,
  useInteractableState,
} from "@assistant-ui/react";
```

## Register the scope

Add the `Interactables()` scope to the runtime via `useAui`, then pass the result to `AssistantRuntimeProvider`.

```tsx
function MyRuntimeProvider({ children }: { children: React.ReactNode }) {
  const aui = useAui({
    interactables: Interactables(),
  });

  return (
    <AssistantRuntimeProvider aui={aui} runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
```

Combine with other scopes such as tools:

```tsx
const aui = useAui({
  tools: Tools({ toolkit: myToolkit }),
  interactables: Interactables(),
});
```

The interactable component can live anywhere inside the provider, including outside the chat panel.

```tsx
function App() {
  return (
    <MyRuntimeProvider>
      <div className="flex">
        <Thread className="flex-1" />
        <TaskBoard />
      </div>
    </MyRuntimeProvider>
  );
}
```

## useAssistantInteractable

Registers an interactable and returns its instance `id`. Define `stateSchema` and `initialState` outside the component (or memoize them); new object identities on every render trigger re-registration and reset state.

```tsx
import { z } from "zod";

const taskBoardSchema = z.object({
  tasks: z.array(
    z.object({ id: z.string(), title: z.string(), done: z.boolean() }),
  ),
});

const taskBoardInitialState = { tasks: [] };

function TaskBoard() {
  const id = useAssistantInteractable("taskBoard", {
    description: "A task board showing the user's tasks",
    stateSchema: taskBoardSchema,
    initialState: taskBoardInitialState,
  });

  // ...
}
```

Config fields:

```ts
interface InteractableConfig {
  description: string;                  // Shown to the AI
  stateSchema: StandardSchemaV1;        // Zod schema or JSON Schema
  initialState: unknown;
  id?: string;                          // Auto-generated if omitted
  selected?: boolean;                   // Mark as focused at registration time
}
```

The first argument (`name`) feeds the auto-generated tool name and is referenced in the system prompt.

## useInteractableState

Reads and writes the state of a registered interactable. The setter behaves like `useState`, accepting a value or an updater function. Pass a `fallback` used before registration completes.

```tsx
function TaskBoard() {
  const id = useAssistantInteractable("taskBoard", {
    description: "A task board showing the user's tasks",
    stateSchema: taskBoardSchema,
    initialState: taskBoardInitialState,
  });

  const [state, { setState }] = useInteractableState(id, taskBoardInitialState);

  return (
    <ul>
      {state.tasks.map((task) => (
        <li key={task.id}>
          <label>
            <input
              type="checkbox"
              checked={task.done}
              onChange={() =>
                setState((prev) => ({
                  tasks: prev.tasks.map((t) =>
                    t.id === task.id ? { ...t, done: !t.done } : t,
                  ),
                }))
              }
            />
            {task.title}
          </label>
        </li>
      ))}
    </ul>
  );
}
```

The second tuple element exposes the full control surface:

```ts
const [state, { setState, setSelected, isPending, error, flush }] =
  useInteractableState(id, fallback);
```

- `setState(value | (prev) => next)`: update state; the new value is also sent to the model context for the next turn.
- `setSelected(boolean)`: mark this interactable as the focused one.
- `isPending`: `true` while a persistence save is in flight.
- `error`: error from the last failed save.
- `flush()`: force an immediate persistence save, returns a promise.

User `setState` calls and AI tool calls write to the same state, so the UI and model stay in sync bidirectionally.

## Auto-generated update tools

For each registered interactable the framework generates a frontend tool the AI calls to mutate state.

- One instance of a name: tool is `update_{name}` (for example `update_taskBoard`).
- Multiple instances of a name: tools are `update_{name}_{id}` (for example `update_note_note-1`).

The tool uses a partial version of `stateSchema`: every field becomes optional, so the model sends only what it changes.

```ts
// Current state: { title: "My Note", content: "Hello", color: "yellow" }
// AI calls:
update_note({ color: "blue" });
// Result: { title: "My Note", content: "Hello", color: "blue" }
```

Note: the merge is shallow (one level). Nested objects are replaced, not deep-merged.

## Multiple instances

Reuse the same `name` with distinct `id`s. Each instance gets its own tool.

```tsx
const noteSchema = z.object({
  title: z.string(),
  content: z.string(),
  color: z.enum(["yellow", "blue", "green", "pink"]),
});

const noteInitialState = {
  title: "New Note",
  content: "",
  color: "yellow" as const,
};

function NoteCard({ noteId }: { noteId: string }) {
  useAssistantInteractable("note", {
    id: noteId,
    description: "A sticky note",
    stateSchema: noteSchema,
    initialState: noteInitialState,
  });

  const [state] = useInteractableState(noteId, noteInitialState);
  return <div>{state.title}</div>;
}

function Notes() {
  return (
    <>
      <NoteCard noteId="note-1" /> {/* update_note_note-1 */}
      <NoteCard noteId="note-2" /> {/* update_note_note-2 */}
    </>
  );
}
```

When a component unmounts, its tool is removed from the AI's list but its state is preserved in the scope. Remounting with the same `name` and `id` restores the preserved state instead of resetting to `initialState`, which handles Strict Mode double-mounts and tab switches.

## Selection

Marking an interactable selected tells the model to prioritize it; the AI sees `(SELECTED)` next to it in the system prompt.

```tsx
function NoteCard({ noteId }: { noteId: string }) {
  const [state, { setSelected }] = useInteractableState(noteId, noteInitialState);

  return (
    <div onClick={() => setSelected(true)}>
      {state.title}
    </div>
  );
}
```

Selection can also be set at registration with `config.selected: true`.

## Streaming updates

State updates progressively as the AI streams tool arguments, so fields appear one at a time. Detect an in-progress run with `useAuiState` to show skeleton UI.

```tsx
function TaskBoard() {
  const id = useAssistantInteractable("taskBoard", {
    description: "A task board",
    stateSchema: taskBoardSchema,
    initialState: taskBoardInitialState,
  });
  const [state] = useInteractableState(id, taskBoardInitialState);

  const isRunning = useAuiState((s) => s.thread.isRunning);
  const isLoading = isRunning && state.tasks.length === 0;

  if (isLoading) return <Skeleton />;
  return <TaskList tasks={state.tasks} />;
}
```

## Persistence

State is in-memory by default. Register a persistence adapter on the scope to save it; importing previously saved state rehydrates the interactables.

```tsx
function PersistenceSetup() {
  const aui = useAui();

  useEffect(() => {
    aui.interactables.setPersistenceAdapter({
      save: async (state) => {
        localStorage.setItem("interactables", JSON.stringify(state));
      },
    });

    const saved = localStorage.getItem("interactables");
    if (saved) {
      aui.interactables.importState(JSON.parse(saved));
    }
  }, [aui]);

  return null;
}
```

- State changes are debounced 500ms before `save` is called.
- A pending save is flushed immediately when a component unregisters.
- `isPending`, `error`, and `flush()` from `useInteractableState` expose sync status to the UI.

## Export and import

Read or replace the full snapshot directly through the scope.

```tsx
const aui = useAui();

const snapshot = aui.interactables.exportState();
// => { "note-1": { name: "note", state: { title: "Hello" } }, ... }

aui.interactables.importState(snapshot);
```

## Schema evolution

Changing a `stateSchema` after persisting state can cause silent mismatches when old data is imported. Mitigate by versioning the storage key (for example `taskBoard_v2`), namespacing by a schema hash on breaking changes, or running a migration step inside your `importState` call.
