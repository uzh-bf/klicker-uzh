# Composer Mentions and Slash Commands

Type-ahead popovers in the composer: `@` mentions insert directive chips, `/` slash commands insert a chip and fire an action. Both are built on `ComposerPrimitive.Unstable_TriggerPopover` (unstable, under active development).

## Contents

- [Imports](#imports)
- [Quick start: slash commands](#quick-start-slash-commands)
- [Quick start: mentions](#quick-start-mentions)
- [unstable_useMentionAdapter](#unstable_usementionadapter)
- [unstable_useSlashCommandAdapter](#unstable_useslashcommandadapter)
- [Unstable_TriggerAdapter](#unstable_triggeradapter)
- [TriggerPopover components](#triggerpopover-components)
- [Behavior sub-primitives: Directive vs Action](#behavior-sub-primitives-directive-vs-action)
- [Categories and drill-down](#categories-and-drill-down)
- [Combining mentions and slash commands](#combining-mentions-and-slash-commands)
- [Commands with arguments](#commands-with-arguments)
- [Async adapters](#async-adapters)
- [Lexical input](#lexical-input)
- [Directive format and backend parsing](#directive-format-and-backend-parsing)
- [Scope context hook](#scope-context-hook)

## Imports

```ts
import {
  ComposerPrimitive,
  unstable_useMentionAdapter,
  unstable_useSlashCommandAdapter,
  unstable_defaultDirectiveFormatter,
  unstable_useTriggerPopoverScopeContext,
  unstable_useTriggerPopoverTriggers,
  type Unstable_DirectiveFormatter,
  type Unstable_Mention,
  type Unstable_SlashCommand,
} from "@assistant-ui/react";
import type { Unstable_TriggerAdapter } from "@assistant-ui/core";
import { LexicalComposerInput } from "@assistant-ui/react-lexical";
```

## Quick start: slash commands

`unstable_useSlashCommandAdapter` builds the adapter from a list of commands and returns a spreadable bundle `{ adapter, action }`.

```tsx
const SLASH_COMMANDS: readonly Unstable_SlashCommand[] = [
  { id: "summarize", description: "Summarize the conversation", execute: () => console.log("Summarize!") },
  { id: "translate", description: "Translate text to another language", execute: () => console.log("Translate!") },
  { id: "help", description: "List all available commands", execute: () => console.log("Help!") },
];

function MyComposer() {
  const slash = unstable_useSlashCommandAdapter({ commands: SLASH_COMMANDS });
  return (
    <ComposerPrimitive.Unstable_TriggerPopoverRoot>
      <ComposerPrimitive.Root>
        <ComposerPrimitive.Input placeholder="Type / for commands..." />
        <ComposerPrimitive.Send>Send</ComposerPrimitive.Send>
        <ComposerPrimitive.Unstable_TriggerPopover char="/" adapter={slash.adapter} className="popover">
          <ComposerPrimitive.Unstable_TriggerPopover.Action {...slash.action} />
          <ComposerPrimitive.Unstable_TriggerPopoverItems>
            {(items) =>
              items.map((item, index) => (
                <ComposerPrimitive.Unstable_TriggerPopoverItem
                  key={item.id}
                  item={item}
                  index={index}
                  className="popover-item"
                >
                  <strong>{item.label}</strong>
                  {item.description && <span>{item.description}</span>}
                </ComposerPrimitive.Unstable_TriggerPopoverItem>
              ))
            }
          </ComposerPrimitive.Unstable_TriggerPopoverItems>
        </ComposerPrimitive.Unstable_TriggerPopover>
      </ComposerPrimitive.Root>
    </ComposerPrimitive.Unstable_TriggerPopoverRoot>
  );
}
```

Note: `Unstable_TriggerPopoverRoot` must be the outermost primitive, wrapping `ComposerPrimitive.Root`.

## Quick start: mentions

`unstable_useMentionAdapter` returns `{ adapter, directive, iconMap?, fallbackIcon? }`. With no options it sources items from the model context tools.

```tsx
function MyComposer() {
  const mention = unstable_useMentionAdapter();
  return (
    <ComposerPrimitive.Unstable_TriggerPopoverRoot>
      <ComposerPrimitive.Root>
        <ComposerPrimitive.Input placeholder="Type @ to mention..." />
        <ComposerPrimitive.Send>Send</ComposerPrimitive.Send>
        <ComposerPrimitive.Unstable_TriggerPopover char="@" adapter={mention.adapter}>
          <ComposerPrimitive.Unstable_TriggerPopover.Directive {...mention.directive} />
          <ComposerPrimitive.Unstable_TriggerPopoverItems>
            {(items) =>
              items.map((item) => (
                <ComposerPrimitive.Unstable_TriggerPopoverItem key={item.id} item={item}>
                  {item.label}
                </ComposerPrimitive.Unstable_TriggerPopoverItem>
              ))
            }
          </ComposerPrimitive.Unstable_TriggerPopoverItems>
        </ComposerPrimitive.Unstable_TriggerPopover>
      </ComposerPrimitive.Root>
    </ComposerPrimitive.Unstable_TriggerPopoverRoot>
  );
}
```

## unstable_useMentionAdapter

| Option | Type | Behavior |
|---|---|---|
| `items` | `Unstable_Mention[]` | Flat list (ignored when `categories` is set) |
| `categories` | `{ id, label, items }[]` | Drill-down groups |
| `includeModelContextTools` | `boolean \| object` | Default: `true` only when neither `items` nor `categories` is given |
| `formatter` | `Unstable_DirectiveFormatter` | Override directive serialization |
| `onInserted` | `(item) => void` | Fires after the directive is inserted |
| `iconMap` | `Record<string, IconComponent>` | Maps `icon` strings to React components |
| `fallbackIcon` | `IconComponent` | Used when no `iconMap` entry matches |

Custom items only:

```ts
const mention = unstable_useMentionAdapter({
  items: [
    { id: "alice", type: "user", label: "Alice", icon: "User" },
    { id: "bob", type: "user", label: "Bob", icon: "User" },
  ],
});
```

Mix custom items with model context tools (flat):

```ts
const mention = unstable_useMentionAdapter({
  items: [{ id: "kb", type: "doc", label: "Knowledge Base", icon: "Book" }],
  includeModelContextTools: true,
});
```

Override the tool category, label formatting, and icon:

```ts
const mention = unstable_useMentionAdapter({
  categories: [{ id: "users", label: "Users", items: [/* ... */] }],
  includeModelContextTools: {
    category: { id: "integrations", label: "Integrations" },
    formatLabel: (name) =>
      name.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    icon: "Wrench",
  },
});
```

## unstable_useSlashCommandAdapter

`Unstable_SlashCommand` fields: `id: string` (required), `label?: string` (defaults to `/${id}`), `description?: string`, `icon?: string`, `execute: () => void` (required).

| Option | Type | Default | Description |
|---|---|---|---|
| `commands` | `Unstable_SlashCommand[]` | none | Command definitions |
| `removeOnExecute` | `boolean` | `false` | Strips the trigger text after execution |
| `iconMap` | `Record<string, IconComponent>` | none | Maps `icon` strings to React components |
| `fallbackIcon` | `IconComponent` | none | Fallback icon component |

Returns `{ adapter, action, iconMap?, fallbackIcon? }`. The hook re-runs on every render, so passing a freshly computed `commands` list always reflects the latest state.

Selecting a command inserts a directive chip (`:command[/summarize]{name=summarize}`) and fires the command's action at the moment of selection. Set `removeOnExecute` for purely transient commands that should leave no chip behind:

```ts
const slash = unstable_useSlashCommandAdapter({
  commands: SLASH_COMMANDS,
  removeOnExecute: true,
});
```

Wrap the action callback to add custom dispatch (logging, analytics) while keeping default behavior:

```tsx
<ComposerPrimitive.Unstable_TriggerPopover.Action
  onExecute={(item) => {
    logCommandUsed(item.id);
    slash.action.onExecute(item);
  }}
/>
```

## Unstable_TriggerAdapter

Both hooks produce an `Unstable_TriggerAdapter`. Implement it directly for full control. All methods are synchronous; back them with external state (React Query, SWR, local state) for async data.

```ts
const adapter: Unstable_TriggerAdapter = {
  categories() {
    return [
      { id: "tools", label: "Tools" },
      { id: "users", label: "Users" },
    ];
  },
  categoryItems(categoryId) {
    if (categoryId === "tools") {
      return [
        { id: "search", type: "tool", label: "Search" },
        { id: "calculator", type: "tool", label: "Calculator" },
      ];
    }
    if (categoryId === "users") {
      return [
        { id: "alice", type: "user", label: "Alice" },
        { id: "bob", type: "user", label: "Bob" },
      ];
    }
    return [];
  },
  // Optional: enables global (cross-category) search mode
  search(query) {
    const lower = query.toLowerCase();
    const all = [...this.categoryItems("tools"), ...this.categoryItems("users")];
    return all.filter(
      (item) =>
        item.label.toLowerCase().includes(lower) ||
        item.id.toLowerCase().includes(lower),
    );
  },
};
```

## TriggerPopover components

| Component | Description |
|---|---|
| `.Unstable_TriggerPopoverRoot` | Outermost wrapper around the whole composer |
| `.Unstable_TriggerPopover` | One trigger; props `char`, `adapter`, optional `className` |
| `.Unstable_TriggerPopover.Directive` | Insert-only behavior (mentions); prop `formatter` |
| `.Unstable_TriggerPopover.Action` | Insert plus action callback (slash commands); props `formatter`, `onExecute` |
| `.Unstable_TriggerPopoverItems` | Render-prop child receiving the filtered item list |
| `.Unstable_TriggerPopoverItem` | One item; props `item`, optional `index`, `className` |
| `.Unstable_TriggerPopoverCategories` | Render-prop child receiving the filtered category list |
| `.Unstable_TriggerPopoverCategoryItem` | One category row; prop `categoryId` |
| `.Unstable_TriggerPopoverBack` | Navigation back button for drill-down |

## Behavior sub-primitives: Directive vs Action

Each `Unstable_TriggerPopover` allows exactly one behavior sub-primitive. Spread the bundle returned by the matching hook into it.

- `Directive` only inserts a directive chip into the composer text. Use it for mentions: `<ComposerPrimitive.Unstable_TriggerPopover.Directive {...mention.directive} />`.
- `Action` inserts a chip and additionally fires `onExecute` at selection. Use it for slash commands: `<ComposerPrimitive.Unstable_TriggerPopover.Action {...slash.action} />`.

Both accept a `formatter` prop. Pass `unstable_defaultDirectiveFormatter` for the standard `:type[label]{name=id}` serialization, or a custom `Unstable_DirectiveFormatter`.

## Categories and drill-down

Provide `categories` to the hook (or implement `categories()` / `categoryItems()` on a manual adapter), then render both `Categories` and `Items`. The popover shows categories first; selecting one drills into its items, and `Back` returns.

```ts
const mention = unstable_useMentionAdapter({
  categories: [
    {
      id: "users",
      label: "Users",
      items: [
        { id: "alice", type: "user", label: "Alice", icon: "User" },
        { id: "bob", type: "user", label: "Bob", icon: "User" },
      ],
    },
    {
      id: "files",
      label: "Files",
      items: [{ id: "readme", type: "file", label: "README.md", icon: "FileText" }],
    },
  ],
  includeModelContextTools: true,
});
```

```tsx
<ComposerPrimitive.Unstable_TriggerPopover char="@" adapter={mention.adapter}>
  <ComposerPrimitive.Unstable_TriggerPopover.Directive {...mention.directive} />
  <ComposerPrimitive.Unstable_TriggerPopoverBack>← Back</ComposerPrimitive.Unstable_TriggerPopoverBack>
  <ComposerPrimitive.Unstable_TriggerPopoverCategories>
    {(categories) =>
      categories.map((cat) => (
        <ComposerPrimitive.Unstable_TriggerPopoverCategoryItem key={cat.id} categoryId={cat.id}>
          {cat.label}
        </ComposerPrimitive.Unstable_TriggerPopoverCategoryItem>
      ))
    }
  </ComposerPrimitive.Unstable_TriggerPopoverCategories>
  <ComposerPrimitive.Unstable_TriggerPopoverItems>
    {(items) =>
      items.map((item, index) => (
        <ComposerPrimitive.Unstable_TriggerPopoverItem key={item.id} item={item} index={index}>
          {item.label}
        </ComposerPrimitive.Unstable_TriggerPopoverItem>
      ))
    }
  </ComposerPrimitive.Unstable_TriggerPopoverItems>
</ComposerPrimitive.Unstable_TriggerPopover>
```

## Combining mentions and slash commands

Share one `TriggerPopoverRoot`; give each trigger its own `TriggerPopover` with its own behavior sub-primitive. Keyboard events route to whichever trigger is currently active.

```tsx
<ComposerPrimitive.Unstable_TriggerPopoverRoot>
  <ComposerPrimitive.Root>
    <ComposerPrimitive.Input placeholder="Type @ to mention, / for commands..." />
    <ComposerPrimitive.Send>Send</ComposerPrimitive.Send>

    <ComposerPrimitive.Unstable_TriggerPopover char="@" adapter={mention.adapter}>
      <ComposerPrimitive.Unstable_TriggerPopover.Directive {...mention.directive} />
      <ComposerPrimitive.Unstable_TriggerPopoverItems>
        {(items) =>
          items.map((item) => (
            <ComposerPrimitive.Unstable_TriggerPopoverItem key={item.id} item={item}>
              {item.label}
            </ComposerPrimitive.Unstable_TriggerPopoverItem>
          ))
        }
      </ComposerPrimitive.Unstable_TriggerPopoverItems>
    </ComposerPrimitive.Unstable_TriggerPopover>

    <ComposerPrimitive.Unstable_TriggerPopover char="/" adapter={slash.adapter}>
      <ComposerPrimitive.Unstable_TriggerPopover.Action {...slash.action} />
      <ComposerPrimitive.Unstable_TriggerPopoverItems>
        {(items) =>
          items.map((item, index) => (
            <ComposerPrimitive.Unstable_TriggerPopoverItem key={item.id} item={item} index={index}>
              {item.label}
            </ComposerPrimitive.Unstable_TriggerPopoverItem>
          ))
        }
      </ComposerPrimitive.Unstable_TriggerPopoverItems>
    </ComposerPrimitive.Unstable_TriggerPopover>
  </ComposerPrimitive.Root>
</ComposerPrimitive.Unstable_TriggerPopoverRoot>
```

## Commands with arguments

Read the raw composer value inside `execute` to parse arguments after the command. Pair with `removeOnExecute` to clear the input.

```tsx
function MyComposer() {
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const slash = unstable_useSlashCommandAdapter({
    commands: SLASH_COMMANDS.map((cmd) => ({
      ...cmd,
      execute: () => {
        const raw = composerRef.current?.value ?? "";
        const match = raw.match(new RegExp(`^/${cmd.id}\\s+(.*)`));
        const args = match?.[1]?.trim() ?? "";
        handleCommand(cmd.id, args);
      },
    })),
    removeOnExecute: true,
  });
  return (
    <ComposerPrimitive.Unstable_TriggerPopoverRoot>
      <ComposerPrimitive.Root>
        <ComposerPrimitive.Input ref={composerRef} placeholder="Type / for commands..." />
        <ComposerPrimitive.Unstable_TriggerPopover char="/" adapter={slash.adapter}>
          <ComposerPrimitive.Unstable_TriggerPopover.Action {...slash.action} />
          <ComposerPrimitive.Unstable_TriggerPopoverItems>
            {(items) =>
              items.map((item, i) => (
                <ComposerPrimitive.Unstable_TriggerPopoverItem key={item.id} item={item} index={i}>
                  <strong>{item.label}</strong>
                  {item.description && <span>{item.description}</span>}
                </ComposerPrimitive.Unstable_TriggerPopoverItem>
              ))
            }
          </ComposerPrimitive.Unstable_TriggerPopoverItems>
        </ComposerPrimitive.Unstable_TriggerPopover>
        <ComposerPrimitive.Send>Send</ComposerPrimitive.Send>
      </ComposerPrimitive.Root>
    </ComposerPrimitive.Unstable_TriggerPopoverRoot>
  );
}
```

## Async adapters

Adapter methods are synchronous, so drive them from external async state. Slash commands and mentions can both swap their source list on every render.

```tsx
// Slash commands from a query
function MyComposer() {
  const { data: commands = [] } = useQuery({
    queryKey: ["slash-commands"],
    queryFn: fetchAvailableCommands,
  });
  const slash = unstable_useSlashCommandAdapter({ commands });
  return (/* ... */);
}
```

```ts
// Mention search backed by React Query
function useMentionAdapter(query: string): Unstable_TriggerAdapter {
  const { data = [] } = useQuery({
    queryKey: ["mention-search", query],
    queryFn: () => fetchUsers(query),
    enabled: query.length > 0,
  });

  return useMemo(() => ({
    categories: () => [],
    categoryItems: () => [],
    search: () => data.map((u) => ({ id: u.id, type: "user", label: u.name })),
  }), [data]);
}
```

## Lexical input

`LexicalComposerInput` renders inserted directives as inline chips. It auto-discovers every `Directive` trigger under `TriggerPopoverRoot`, so the structure is otherwise the same as the textarea version.

```tsx
<ComposerPrimitive.Unstable_TriggerPopoverRoot>
  <ComposerPrimitive.Root>
    <LexicalComposerInput placeholder="Type @ to mention..." />
    <ComposerPrimitive.Send />
    <ComposerPrimitive.Unstable_TriggerPopover char="@" adapter={mention.adapter}>
      <ComposerPrimitive.Unstable_TriggerPopover.Directive {...mention.directive} />
      {/* categories / items render props same as above */}
    </ComposerPrimitive.Unstable_TriggerPopover>
  </ComposerPrimitive.Root>
</ComposerPrimitive.Unstable_TriggerPopoverRoot>
```

## Directive format and backend parsing

Default serialization is `:type[label]{name=id}`, for example `:tool[Get Weather]{name=get_weather}`. When `id === label`, the attribute is omitted: `:tool[search]`.

Parse directives out of the message text on the backend:

```ts
const DIRECTIVE_RE = /:([\w-]+)\[([^\]]+)\](?:\{name=([^}]+)\})?/g;

function parseMentions(text: string) {
  const mentions = [];
  let match;
  while ((match = DIRECTIVE_RE.exec(text)) !== null) {
    mentions.push({
      type: match[1],
      label: match[2],
      id: match[3] ?? match[2],
    });
  }
  return mentions;
}
```

Supply a custom `Unstable_DirectiveFormatter` to change serialization (for example, render `/id` instead of the default form), and pass it as the `formatter` prop on `Directive` or `Action`. `createDirectiveText(formatter)` returns a component you can wire into message rendering so directives display as chips on sent messages:

```tsx
const SlashDirectiveText = createDirectiveText(slashFormatter);

<MessagePrimitive.Parts components={{ Text: SlashDirectiveText }} />
```

## Scope context hook

`unstable_useTriggerPopoverScopeContext` exposes the live popover state. Must be called inside a `ComposerPrimitive.Unstable_TriggerPopover`.

```ts
function MyPopoverContent() {
  const scope = unstable_useTriggerPopoverScopeContext();
  // scope.open              popover visibility
  // scope.query             text after the trigger character
  // scope.categories        filtered category list
  // scope.items             filtered item list
  // scope.highlightedIndex  keyboard-navigated index
  // scope.isSearchMode      true when global search is active
  // scope.selectItem(item)  programmatic selection
  // scope.close()           close the popover
  return null;
}
```
