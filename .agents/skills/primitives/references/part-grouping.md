# Message Part Grouping

Organize adjacent message parts into custom groups, and build chain-of-thought UI (reasoning + tools collapsed into a "thinking" accordion).

## Contents

- [Imports](#imports)
- [MessagePrimitive.GroupedParts](#messageprimitivegroupedparts)
- [groupPartByType](#grouppartbytype)
- [Group keys and synthetic parts](#group-keys-and-synthetic-parts)
- [Chain of thought](#chain-of-thought)
- [Reasoning UI](#reasoning-ui)
- [Sources UI](#sources-ui)
- [Grouping by parentId or tool name](#grouping-by-parentid-or-tool-name)
- [Standalone tool display](#standalone-tool-display)
- [Legacy: Unstable_PartsGrouped](#legacy-unstable_partsgrouped)
- [Legacy: ChainOfThoughtPrimitive](#legacy-chainofthoughtprimitive)
- [Notes](#notes)

## Imports

```ts
import { MessagePrimitive, groupPartByType } from "@assistant-ui/react";
```

Group-related types from `@assistant-ui/react`: `GroupPart`, `MessagePartGroup`, `ReasoningMessagePartComponent`, `SourceMessagePartComponent`.

## MessagePrimitive.GroupedParts

Renders parts through a `groupBy` function that maps each part to a group-key path. Adjacent parts that resolve to the same key are wrapped together. The children render function receives `{ part, children }` and is called once per group node and once per leaf part.

```tsx
<MessagePrimitive.GroupedParts
  groupBy={groupPartByType({
    "tool-call": ["group-tool"],
  })}
>
  {({ part, children }) => {
    switch (part.type) {
      case "group-tool":
        return <div className="group">{children}</div>;
      case "tool-call":
        return part.toolUI ?? <ToolFallback {...part} />;
      case "text":
        return <MarkdownText />;
      default:
        return null;
    }
  }}
</MessagePrimitive.GroupedParts>
```

| Prop | Type | Description |
|------|------|-------------|
| `groupBy` | `(part) => readonly \`group-${string}\`[]` | Maps a part to a group-key path. Return `[]` to leave it ungrouped. |
| `children` | `({ part, children }) => ReactNode` | Render function for group nodes and leaf parts. |

Render `children` only for group cases. Leaf cases (`text`, `tool-call`, `reasoning`, etc.) render the part itself; rendering `children` from a leaf case throws.

## groupPartByType

Builds a `groupBy` from a `part.type` to group-key-path map. Part types not listed are left ungrouped. Each value is a nested path: the first key is the outer group, later keys are inner groups.

```ts
groupPartByType({
  reasoning: ["group-chainOfThought", "group-reasoning"],
  "tool-call": ["group-chainOfThought", "group-tool"],
});
```

`reasoning` parts land in `group-chainOfThought > group-reasoning`; `tool-call` parts in `group-chainOfThought > group-tool`. Both share the outer `group-chainOfThought`, so adjacent reasoning and tool parts collapse into one chain-of-thought block.

## Group keys and synthetic parts

Group keys must start with `group-`. This lets the render function distinguish synthetic group nodes from real part types like `text` or `tool-call`.

A group node passed to `children` has the `GroupPart` shape:

```ts
type GroupPart<TKey extends `group-${string}` = `group-${string}`> = {
  readonly type: TKey;
  readonly status: MessagePartStatus | ToolCallMessagePartStatus;
  readonly indices: readonly number[];
};
```

Use `part.indices.length` for a count and `part.status.type` for streaming state (for example `"running"`).

## Chain of thought

Group consecutive reasoning tokens and tool calls into a collapsible thinking accordion. This is the canonical chain-of-thought API; render reasoning and tool groups with the Reasoning and tool-group UI components.

```tsx
import { MessagePrimitive, groupPartByType } from "@assistant-ui/react";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import {
  Reasoning,
  ReasoningContent,
  ReasoningRoot,
  ReasoningText,
  ReasoningTrigger,
} from "@/components/assistant-ui/reasoning";
import { ToolFallback } from "@/components/assistant-ui/tool-fallback";
import {
  ToolGroupContent,
  ToolGroupRoot,
  ToolGroupTrigger,
} from "@/components/assistant-ui/tool-group";
import type { FC } from "react";

const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root>
      <MessagePrimitive.GroupedParts
        groupBy={groupPartByType({
          reasoning: ["group-chainOfThought", "group-reasoning"],
          "tool-call": ["group-chainOfThought", "group-tool"],
        })}
      >
        {({ part, children }) => {
          switch (part.type) {
            case "group-chainOfThought":
              return <div className="my-2">{children}</div>;
            case "group-reasoning": {
              const running = part.status.type === "running";
              return (
                <ReasoningRoot defaultOpen={running}>
                  <ReasoningTrigger active={running} />
                  <ReasoningContent aria-busy={running}>
                    <ReasoningText>{children}</ReasoningText>
                  </ReasoningContent>
                </ReasoningRoot>
              );
            }
            case "group-tool":
              return (
                <ToolGroupRoot>
                  <ToolGroupTrigger
                    count={part.indices.length}
                    active={part.status.type === "running"}
                  />
                  <ToolGroupContent>{children}</ToolGroupContent>
                </ToolGroupRoot>
              );
            case "text":
              return <MarkdownText />;
            case "reasoning":
              return <Reasoning {...part} />;
            case "tool-call":
              return part.toolUI ?? <ToolFallback {...part} />;
            default:
              return null;
          }
        }}
      </MessagePrimitive.GroupedParts>
    </MessagePrimitive.Root>
  );
};
```

Note: LangGraph does not emit reasoning in the AI SDK reasoning stream format. To show LangGraph reasoning, emit it as a custom data part and render it via `makeAssistantDataUI`.

## Reasoning UI

The `reasoning` registry component (`https://r.assistant-ui.com/reasoning.json`) provides a collapsible thinking accordion. Exports from `@/components/assistant-ui/reasoning`: `Reasoning`, `ReasoningRoot`, `ReasoningTrigger`, `ReasoningContent`, `ReasoningText`, `ReasoningFade`, `reasoningVariants`. `ReasoningGroup` is deprecated.

```tsx
<MessagePrimitive.GroupedParts
  groupBy={groupPartByType({ reasoning: ["group-reasoning"] })}
>
  {({ part, children }) => {
    switch (part.type) {
      case "group-reasoning": {
        const running = part.status.type === "running";
        return (
          <ReasoningRoot defaultOpen={running}>
            <ReasoningTrigger active={running} />
            <ReasoningContent aria-busy={running}>
              <ReasoningText>{children}</ReasoningText>
            </ReasoningContent>
          </ReasoningRoot>
        );
      }
      case "text":
        return <MarkdownText />;
      case "reasoning":
        return <Reasoning {...part} />;
      case "tool-call":
        return part.toolUI ?? <ToolFallback {...part} />;
      default:
        return null;
    }
  }}
</MessagePrimitive.GroupedParts>
```

Wire `part.status.type === "running"` into `defaultOpen` so the accordion opens automatically while reasoning streams and stays closed once done. The `group-reasoning` case must render `{children}`; the leaf `reasoning` case must not.

| Component | Notable props |
|-----------|---------------|
| `ReasoningRoot` | `defaultOpen?`, `open?`, `onOpenChange?`, `variant?` (`"outline"` default, `"ghost"`, `"muted"`) |
| `ReasoningTrigger` | `active?` (shimmer while streaming), `duration?` (appends `(Ns)`) |
| `ReasoningContent` | wraps `CollapsibleContent`; includes `ReasoningFade` |
| `ReasoningText` | scrollable text container (`max-h-64`) |
| `Reasoning` | leaf `ReasoningMessagePartComponent`, renders the part via markdown |

## Sources UI

The `sources` registry component (`https://r.assistant-ui.com/sources.json`) renders URL and document citations. `Sources` is a `SourceMessagePartComponent`; render it from a leaf `source` case.

```tsx
import { Sources } from "@/components/assistant-ui/sources";

<MessagePrimitive.Parts>
  {({ part }) => {
    if (part.type === "source") return <Sources {...part} />;
    return null;
  }}
</MessagePrimitive.Parts>
```

`Sources` branches on `part.sourceType`: `"url"` renders a linked badge with favicon and title (falling back to the domain), `"document"` renders a non-linked badge with a file icon and `part.title`. Compound sub-components `Sources.Root` (`Source`), `Sources.Icon` (`SourceIcon`), `Sources.Title` (`SourceTitle`) allow custom composition.

```tsx
<Sources.Root href="https://example.com">
  <Sources.Icon
    url="https://example.com"
    faviconUrl={(domain) => `https://my-proxy.example.com/${domain}.ico`}
  />
  <Sources.Title>Example</Sources.Title>
</Sources.Root>
```

To group sources by their `parentId` (for example all citations under one tool result), use `GroupedParts` with a `group-parent-` key (see below).

## Grouping by parentId or tool name

`groupBy` is arbitrary, so you can group on any part field. Return a key starting with `group-`, and branch on `part.type.startsWith(...)` in the render function.

```tsx
<MessagePrimitive.GroupedParts
  groupBy={(part) => {
    if (!part.parentId) return [];
    return [`group-parent-${part.parentId}`];
  }}
>
  {({ part, children }) => {
    if (part.type.startsWith("group-parent-")) {
      const id = part.type.replace("group-parent-", "");
      return (
        <ParentGroup id={id} count={part.indices.length}>
          {children}
        </ParentGroup>
      );
    }
    if (part.type === "text") return <MarkdownText />;
    if (part.type === "source") return <Sources {...part} />;
    if (part.type === "tool-call") return part.toolUI ?? <ToolFallback {...part} />;
    return null;
  }}
</MessagePrimitive.GroupedParts>
```

Group by tool name the same way, keying on `part.toolName`:

```tsx
groupBy={(part) => {
  if (part.type !== "tool-call") return [];
  return [`group-tool-${part.toolName}`];
}}
```

## Standalone tool display

`groupPartByType` understands the synthetic `"standalone-tool-call"` key, which matches tools marked `display: "standalone"`, MCP-app calls, and `human`-type tools. Map it to `[]` to keep those tools out of the chain-of-thought group and render them inline.

```ts
const toolkit = {
  ask_user: { type: "human", render: AskUI },           // standalone (forced)
  search_web: { type: "frontend", render: SearchUI },   // inline trace (default)
  checkout: { type: "frontend", render: CheckoutUI, display: "standalone" },
} satisfies Toolkit;
```

```tsx
<MessagePrimitive.GroupedParts
  groupBy={groupPartByType({
    reasoning: ["group-chainOfThought", "group-reasoning"],
    "tool-call": ["group-chainOfThought", "group-tool"],
    "standalone-tool-call": [],
  })}
>
  {({ part, children }) => {
    switch (part.type) {
      case "group-chainOfThought":
        return <div className="chain-of-thought">{children}</div>;
      case "tool-call":
        return part.toolUI ?? <ToolFallback {...part} />;
      default:
        return null;
    }
  }}
</MessagePrimitive.GroupedParts>
```

Note: the `"mcp-app"` key was **removed in 0.15**. Use `"standalone-tool-call"`, a superset that matches MCP-app tool calls plus any tool call whose registered UI opts into standalone display.

```diff
  groupPartByType({
    "tool-call": ["group-tool"],
-   "mcp-app": [],
+   "standalone-tool-call": [],
  })
```

## Legacy: Unstable_PartsGrouped

`MessagePrimitive.Unstable_PartsGrouped` predates `GroupedParts`. It accepts a `groupingFunction` that returns `MessagePartGroup[]` (not adjacency-limited) and a `components` map. Prefer `GroupedParts` in new code.

```ts
type MessagePartGroup = {
  groupKey: string | undefined;
  indices: number[];
};
```

```tsx
<MessagePrimitive.Unstable_PartsGrouped
  groupingFunction={(parts) => {
    const groups = new Map<string, number[]>();
    parts.forEach((part, index) => {
      const key = part.parentId ?? `__ungrouped_${index}`;
      const indices = groups.get(key) ?? [];
      indices.push(index);
      groups.set(key, indices);
    });
    return Array.from(groups.entries()).map(([key, indices]) => ({
      groupKey: key.startsWith("__ungrouped_") ? undefined : key,
      indices,
    }));
  }}
  components={{
    Text: MarkdownText,
    tools: { Fallback: ToolFallback },
    Group: ({ groupKey, children }) => {
      if (!groupKey) return <>{children}</>;
      return <div className="rounded-lg border p-3">{children}</div>;
    },
  }}
/>
```

The `components` map supports `Empty`, `Text`, `Reasoning`, `Source`, `Image`, `File`, `Unstable_Audio`, `tools`, and `Group`.

## Legacy: ChainOfThoughtPrimitive

`ChainOfThoughtPrimitive` and the `components.ChainOfThought` prop on `MessagePrimitive.Parts` are older chain-of-thought APIs. They still function but should not be used in new code; reach for `GroupedParts` instead. The collapsed state can be read with `AuiIf`:

```tsx
import { AuiIf, ChainOfThoughtPrimitive } from "@assistant-ui/react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

const ChainOfThoughtAccordionTrigger = () => (
  <ChainOfThoughtPrimitive.AccordionTrigger className="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-sm">
    <AuiIf condition={(s) => s.chainOfThought.collapsed}>
      <ChevronRightIcon className="size-4" />
    </AuiIf>
    <AuiIf condition={(s) => !s.chainOfThought.collapsed}>
      <ChevronDownIcon className="size-4" />
    </AuiIf>
    Thinking
  </ChainOfThoughtPrimitive.AccordionTrigger>
);
```

## Notes

- `GroupedParts` groups adjacent runs only: the same key appearing again after a gap starts a new group.
- Always handle every renderable leaf part type, or those parts render nothing.
- Group keys must begin with `group-`; the render function relies on that prefix.
- Use `part.status.type === "running"` to drive `defaultOpen` and streaming indicators.
