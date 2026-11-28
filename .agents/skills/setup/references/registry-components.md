# Prebuilt Registry Components

Optional UI components installed via `npx assistant-ui add <name>`. Like all registry components they land as editable local TSX under `components/assistant-ui/`, so customize them in place (see the `styling` reference).

## Contents

- [Available items](#available-items)
- [Radix vs Base UI flavors](#radix-vs-base-ui-flavors)
- [AssistantModal](#assistantmodal)
- [AssistantSidebar](#assistantsidebar)
- [ModelSelector](#modelselector)
- [Attachment UI](#attachment-ui)

## Available items

`npx assistant-ui@latest add <name>` currently serves:

| Group | Items |
|-------|-------|
| Chat surfaces | `thread`, `thread-list`, `threadlist-sidebar`, `assistant-modal`, `assistant-sidebar`, `eve-chat` |
| Message rendering | `markdown-text`, `shiki-highlighter`, `syntax-highlighter`, `mermaid-diagram`, `reasoning`, `sources`, `quote`, `message-timing`, `directive-text` |
| Tools and generative UI | `tool-fallback`, `tool-group`, `generative-ui`, `generative-ui-style`, `mcp-config`, `context-display` |
| Composer and input | `composer-trigger-popover`, `attachment`, `file`, `image`, `voice`, `follow-up-suggestions` |
| Backend routes | `ai-sdk-backend`, `ai-sdk-backend-resumable` |
| Shared UI | `accordion`, `badge`, `select`, `tabs`, `tooltip-icon-button`, `dot-matrix`, `number-roll`, `diff-viewer`, `heat-graph`, `logos`, `shimmer-style`, `direction`, `model-selector` |

## Radix vs Base UI flavors

The registry ships both a Radix and a Base UI flavor of each component. Point `components.json` at the style-aware URL so installs follow your shadcn style:

```json
{
  "registries": {
    "@assistant-ui": "https://r.assistant-ui.com/styles/{style}/{name}.json"
  }
}
```

`{style}` comes from the `style` field in `components.json`. A style whose name starts with `base-` resolves to the Base UI components; every other style resolves to Radix. Existing Radix projects can keep the flat `https://r.assistant-ui.com/{name}.json` URL as a fallback.

## AssistantModal

Floating popup chat launched from a corner button. Built on `AssistantModalPrimitive` and renders the standard `Thread` inside.

```bash
npx assistant-ui add assistant-modal
```

```tsx
// app/page.tsx
import { AssistantModal } from "@/components/assistant-ui/assistant-modal";

export default function Page() {
  return <AssistantModal />;
}
```

Must be a descendant of `AssistantRuntimeProvider` so it shares the same runtime as the rest of the app.

The generated component composes these primitives from `@assistant-ui/react`:

```tsx
import { AssistantModalPrimitive } from "@assistant-ui/react";

<AssistantModalPrimitive.Root>
  <AssistantModalPrimitive.Anchor>
    <AssistantModalPrimitive.Trigger asChild>
      {/* the floating bot button */}
    </AssistantModalPrimitive.Trigger>
  </AssistantModalPrimitive.Anchor>
  <AssistantModalPrimitive.Content sideOffset={16}>
    <Thread />
  </AssistantModalPrimitive.Content>
</AssistantModalPrimitive.Root>
```

`AssistantModalPrimitive.Content` accepts `sideOffset` (number) and `className`. The trigger swaps a `BotIcon` for a `ChevronDownIcon` based on `data-state="open" | "closed"`.

## AssistantSidebar

Resizable two-panel co-pilot layout: your app on the left, a `Thread` on the right, separated by a draggable handle. Good for inline assistance alongside existing UI.

```bash
npx assistant-ui add assistant-sidebar
```

```tsx
// app/page.tsx
import { AssistantSidebar } from "@/components/assistant-ui/assistant-sidebar";

export default function Home() {
  return (
    <div className="h-full">
      <AssistantSidebar>{/* your main app content */}</AssistantSidebar>
    </div>
  );
}
```

`AssistantSidebar` is `FC<PropsWithChildren>`; `children` fill the left panel. It depends on the shadcn `resizable` component (`components/ui/resizable`), which `add` installs automatically. Edit the generated file to tune panel sizes:

```tsx
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Thread } from "@/components/assistant-ui/thread";

<ResizablePanelGroup direction="horizontal">
  <ResizablePanel defaultSize={60} minSize={30}>
    {children}
  </ResizablePanel>
  <ResizableHandle withHandle />
  <ResizablePanel defaultSize={40} minSize={20}>
    <Thread />
  </ResizablePanel>
</ResizablePanelGroup>
```

Wrap the whole thing in `AssistantRuntimeProvider` as usual.

## ModelSelector

Client-side dropdown to switch models. The chosen model `id` is registered into the runtime's model context as `config.modelName`, which the server route reads off the request body.

```bash
npx assistant-ui add model-selector
```

```tsx
"use client";

import { useState } from "react";
import { ModelSelector } from "@/components/assistant-ui/model-selector";

const models = [
  { id: "gpt-5.4", name: "GPT-5.4", description: "Most capable" },
  { id: "gpt-5.4-nano", name: "GPT-5.4 nano", description: "Fast and cheap" },
];

function Toolbar() {
  const [modelId, setModelId] = useState("gpt-5.4-nano");
  return (
    <ModelSelector
      models={models}
      value={modelId}
      onValueChange={setModelId}
    />
  );
}
```

Render it inside `AssistantRuntimeProvider`. Each `ModelOption` is `{ id, name, description?, icon?, disabled? }`; the `id` is what travels to the server.

`ModelSelector` props: `models` (required `ModelOption[]`), `value` / `defaultValue` / `onValueChange`, `variant` (`"outline" | "ghost" | "muted"`, default `"outline"`), `size` (`"sm" | "default" | "lg"`), and `contentClassName`.

### How registration works

The component subscribes the selected model into the model context via `useAui().modelContext.register`. The `register` callback returns its own unsubscribe function, so returning it from `useEffect` cleans up on change:

```tsx
import { useEffect } from "react";
import { useAui } from "@assistant-ui/react";

const api = useAui();

useEffect(() => {
  const config = { config: { modelName: value } };
  return api.modelContext.register({
    getModelContext: () => config,
  });
}, [api, value]);
```

### Reading it server-side

The `config` object rides along in the request body. With the AI SDK route the runtime POSTs `{ messages, config }`:

```ts
// app/api/chat/route.ts
import { openai } from "@ai-sdk/openai";
import {
  streamText,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
} from "ai";

export async function POST(req: Request) {
  const { messages, config } = await req.json();
  const result = streamText({
    model: openai(config?.modelName ?? "gpt-5.4-nano"),
    messages: await convertToModelMessages(messages),
  });
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
```

### Composable parts

For custom layout, drop the all-in-one `ModelSelector` and compose `ModelSelectorRoot` / `ModelSelectorTrigger` / `ModelSelectorContent` (also `ModelSelectorItem`, `ModelSelectorValue`):

```tsx
import {
  ModelSelectorRoot,
  ModelSelectorTrigger,
  ModelSelectorContent,
} from "@/components/assistant-ui/model-selector";

<ModelSelectorRoot models={models} value={modelId} onValueChange={setModelId}>
  <ModelSelectorTrigger variant="ghost" />
  <ModelSelectorContent />
</ModelSelectorRoot>
```

Note: `ModelSelectorRoot` is presentational only. The runtime registration lives in the all-in-one `ModelSelector`, so a bare `Root` does not switch the server model on its own.

## Attachment UI

Tiles and buttons for file attachments in the composer and in user messages. The `add attachment` command writes `components/assistant-ui/attachment.tsx` exporting three components.

```bash
npx assistant-ui add attachment
```

Wire them into your `thread.tsx`. In the composer:

```tsx
import {
  ComposerAttachments,
  ComposerAddAttachment,
} from "@/components/assistant-ui/attachment";

<ComposerPrimitive.Root>
  <ComposerAttachments />
  <ComposerAddAttachment />
  <ComposerPrimitive.Input />
</ComposerPrimitive.Root>
```

In a user message, render the sent attachments above the text:

```tsx
import { UserMessageAttachments } from "@/components/assistant-ui/attachment";

<MessagePrimitive.Root>
  <UserMessageAttachments />
  <MessagePrimitive.Parts />
</MessagePrimitive.Root>
```

- `ComposerAttachments`: tiles for pending attachments in the composer, each with a remove button.
- `ComposerAddAttachment`: the add-file button that opens the OS file picker.
- `UserMessageAttachments`: read-only tiles for attachments on a sent user message.

These are built from `AttachmentPrimitive.Root` / `.Name` / `.Remove`, `ComposerPrimitive.Attachments` / `.AddAttachment`, and `MessagePrimitive.Attachments`.

### Adapters are required

These components render UI only. Nothing attaches unless an attachment adapter is configured on the runtime. The adapters live in `@assistant-ui/react`:

```tsx
import {
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
} from "@assistant-ui/react";

const runtime = useChatRuntime({
  adapters: {
    attachments: new CompositeAttachmentAdapter([
      new SimpleImageAttachmentAdapter(),
      new SimpleTextAttachmentAdapter(),
    ]),
  },
});
```

`SimpleImageAttachmentAdapter` handles `image/*` as data URLs; `SimpleTextAttachmentAdapter` handles text files; `CompositeAttachmentAdapter` fans out across a list. For uploads or other content types, implement the `AttachmentAdapter` interface yourself. See the attachments guide for full adapter setup.
