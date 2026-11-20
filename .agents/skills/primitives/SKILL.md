---
name: primitives
description: "Builds and customizes assistant-ui chat UI from composable, unstyled @assistant-ui/react primitives that follow Radix-style part composition. Use when assembling or styling a custom Thread, Composer, message rendering, action bar, or branch picker from building blocks: ThreadPrimitive (.Root, .Viewport, .ViewportFooter, .Messages, .Empty, .ScrollToBottom, .Suggestions), ComposerPrimitive (.Input, .Send, .Cancel, .Attachments, .AddAttachment, .AttachmentDropzone, .Quote, .Dictate, .Queue), MessagePrimitive (.Parts/.Content, .GroupedParts, .Attachments, .Quote, .GenerativeUI, .Error), ActionBarPrimitive (.Copy, .Edit, .Reload, .Speak, .StopSpeaking, feedback, .ExportMarkdown), BranchPickerPrimitive, AttachmentPrimitive, ThreadListPrimitive, ThreadListItemPrimitive, plus ChainOfThoughtPrimitive, SelectionToolbarPrimitive, SuggestionPrimitive, QueueItemPrimitive, ErrorPrimitive, and AssistantModalPrimitive. Covers MessagePrimitive.Parts children render functions for text, image, reasoning, tool-call, data, and generative-ui parts; part grouping with groupPartByType (the \"mcp-app\" key was removed in 0.15, use \"standalone-tool-call\"); conditional rendering with AuiIf (deprecated .If); and gotchas like wrapping in AssistantRuntimeProvider and adding className since primitives ship unstyled. For prebuilt drop-in UI and scaffolding use setup; for multi-thread sidebar behavior use thread-list."
license: MIT
---

# assistant-ui Primitives

**Always consult [assistant-ui.com/llms.txt](https://www.assistant-ui.com/llms.txt) for the latest API.**

Composable, unstyled components following Radix UI patterns.

## References

- [./references/thread.md](./references/thread.md) -- ThreadPrimitive deep dive
- [./references/composer.md](./references/composer.md) -- ComposerPrimitive deep dive
- [./references/message.md](./references/message.md) -- MessagePrimitive deep dive
- [./references/action-bar.md](./references/action-bar.md) -- ActionBarPrimitive deep dive
- [./references/part-grouping.md](./references/part-grouping.md) -- Part grouping and chain-of-thought UI
- [./references/mentions.md](./references/mentions.md) -- Composer mentions and slash commands

## Import

```tsx
import {
  AuiIf,
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ActionBarPrimitive,
  BranchPickerPrimitive,
  AttachmentPrimitive,
  ThreadListPrimitive,
  ThreadListItemPrimitive,
} from "@assistant-ui/react";
```

## Primitive Parts

| Primitive | Key Parts |
|-----------|-----------|
| `ThreadPrimitive` | `.Root`, `.Viewport`, `.ViewportFooter`, `.Messages`, `.Empty`, `.ScrollToBottom`, `.Suggestions`, `.Suggestion` |
| `ComposerPrimitive` | `.Root`, `.Input`, `.Send`, `.Cancel`, `.Attachments`, `.AddAttachment`, `.AttachmentDropzone`, `.Quote`, `.QuoteText`, `.QuoteDismiss`, `.Dictate`, `.StopDictation`, `.DictationTranscript`, `.Queue` |
| `MessagePrimitive` | `.Root`, `.Parts` (`.Content` is a deprecated alias), `.GroupedParts`, `.Attachments`, `.Quote`, `.GenerativeUI`, `.Error` |
| `ActionBarPrimitive` | `.Root`, `.Copy`, `.Edit`, `.Reload`, `.Speak`, `.StopSpeaking`, `.FeedbackPositive`, `.FeedbackNegative`, `.ExportMarkdown` |
| `BranchPickerPrimitive` | `.Root`, `.Previous`, `.Next`, `.Number`, `.Count` |
| `ThreadListPrimitive` | `.Root`, `.New`, `.Items`, `.LoadMore` |
| `ThreadListItemPrimitive` | `.Root`, `.Trigger`, `.Title`, `.Archive`, `.Unarchive`, `.Delete` |
| `AttachmentPrimitive` | `.Root`, `.Name`, `.Remove`, `.unstable_Thumb` |

Also exported, each covered by its own reference or skill: `ChainOfThoughtPrimitive`, `SelectionToolbarPrimitive`, `SuggestionPrimitive`, `QueueItemPrimitive`, `ErrorPrimitive`, `MessagePartPrimitive`, `AssistantModalPrimitive`, `ActionBarMorePrimitive`, `ThreadListItemMorePrimitive`.

## Custom Thread Example

```tsx
function CustomThread() {
  return (
    <ThreadPrimitive.Root className="flex flex-col h-full">
      <ThreadPrimitive.Empty>
        <div className="flex-1 flex items-center justify-center">
          Start a conversation
        </div>
      </ThreadPrimitive.Empty>

      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto p-4">
        <ThreadPrimitive.Messages>
          {({ message }) =>
            message.role === "user" ? (
              <CustomUserMessage />
            ) : (
              <CustomAssistantMessage />
            )
          }
        </ThreadPrimitive.Messages>
      </ThreadPrimitive.Viewport>

      <ComposerPrimitive.Root className="border-t p-4 flex gap-2">
        <ComposerPrimitive.Input className="flex-1 rounded-lg border px-4 py-2" />
        <ComposerPrimitive.Send className="bg-blue-500 text-white px-4 py-2 rounded-lg">
          Send
        </ComposerPrimitive.Send>
      </ComposerPrimitive.Root>
    </ThreadPrimitive.Root>
  );
}
```

## Conditional Rendering

Prefer `AuiIf` for new code. Primitive `.If` components still exist but are deprecated.

```tsx
<AuiIf condition={({ message }) => message.role === "user"}>
  User only
</AuiIf>
<AuiIf condition={({ thread }) => thread.isRunning}>
  Generating...
</AuiIf>
<AuiIf condition={({ message }) => message.branchCount > 1}>
  Has edit history
</AuiIf>

<AuiIf condition={({ thread }) => thread.isRunning}>
  <ComposerPrimitive.Cancel>Stop</ComposerPrimitive.Cancel>
</AuiIf>

<AuiIf condition={({ thread }) => thread.isEmpty}>No messages</AuiIf>
```

## Message Parts (children render function)

As of 0.14, primitives that render lists (`ThreadPrimitive.Messages`, `MessagePrimitive.Parts`, `ThreadPrimitive.Suggestions`, `ThreadListPrimitive.Items`, `ComposerPrimitive.Attachments`) take a children render function instead of a `components` prop. The `components` prop still works but is deprecated.

`MessagePrimitive.Parts` is the canonical name (`MessagePrimitive.Content` is a deprecated alias).

```tsx
<MessagePrimitive.Parts>
  {({ part }) => {
    switch (part.type) {
      case "text":
        return <p>{part.text}</p>;
      case "image":
        return <img src={part.image} alt="" />;
      case "reasoning":
        return (
          <details>
            <summary>Thinking</summary>
            {part.text}
          </details>
        );
      case "tool-call":
        return part.toolUI ?? <div>Tool: {part.toolName}</div>;
      default:
        return null; // registered tool/data UIs still render
    }
  }}
</MessagePrimitive.Parts>
```

Returning `null` from the render function lets registered tool and data UIs render via the registry; return `<></>` to explicitly render nothing.

## Branch Picker

```tsx
<AuiIf condition={({ message }) => message.branchCount > 1}>
  <BranchPickerPrimitive.Root className="flex items-center gap-1">
    <BranchPickerPrimitive.Previous>←</BranchPickerPrimitive.Previous>
    <span><BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count /></span>
    <BranchPickerPrimitive.Next>→</BranchPickerPrimitive.Next>
  </BranchPickerPrimitive.Root>
</AuiIf>
```

## Common Gotchas

**Primitives not rendering**
- Wrap in `AssistantRuntimeProvider`
- Ensure parent primitive provides context

**Styles not applying**
- Primitives are unstyled by default
- Add `className` and style with your app's Tailwind/CSS system
