# assistant-ui Version Migrations

Migrations for upgrading between assistant-ui versions.

## Contents

- [Version Detection](#version-detection)
- [Migration: → 0.15.x (Property accessors, legacy hook removal)](#migration--015x-property-accessors-legacy-hook-removal)
- [Migration: → 0.14.x (Children API, deprecated removals)](#migration--014x-children-api-deprecated-removals)
- [Migration: → 0.13.x (Top-turn anchoring)](#migration--013x-top-turn-anchoring)
- [Migration: → 0.12.x (Unified State API)](#migration--012x-unified-state-api)
- [Migration: → 0.11.x (Runtime Rearchitecture)](#migration--011x-runtime-rearchitecture)
- [Migration: → 0.10.x (ESM Only)](#migration--010x-esm-only)
- [Migration: → 0.9.x (Edge Split)](#migration--09x-edge-split)
- [Migration: → 0.8.x (UI Split)](#migration--08x-ui-split)
- [Migration: → 0.7.x (Thread API)](#migration--07x-thread-api)
- [Migration: → 0.5.x (Runtime API)](#migration--05x-runtime-api)
- [Migration: → 0.4.x (Message Types)](#migration--04x-message-types)
- [Migration: → 0.3.x](#migration--03x)
- [Migration: → 0.2.x](#migration--02x)
- [Automated Search Commands](#automated-search-commands)
- [Verification](#verification)

## Version Detection

```bash
npm ls @assistant-ui/react
npm view @assistant-ui/react version  # Latest
```

## Migration: → 0.15.x (Property accessors, legacy hook removal)

### From 0.14.x

Two themes: `aui` scope accessors become properties, and the v0.12-era legacy context hooks are removed. Upstream guide: https://assistant-ui.com/docs/migrations/v0-15

**Automatic migration:**

```bash
npx assistant-ui@latest upgrade
```

`upgrade` runs the whole codemod bundle in order, not just the newest one:

```
v0-8/ui-package-split
v0-9/edge-package-split
v0-11/content-part-to-message-part
v0-12/assistant-api-to-aui
v0-12/event-names-to-camelcase
v0-12/primitive-if-to-aui-if
v0-15/aui-accessor-calls-to-properties
```

`v0-15/aui-accessor-calls-to-properties` is the one that rewrites nullary accessor calls to property access. The primitive `If` migration onto `AuiIf` comes from `v0-12/primitive-if-to-aui-if`, so running the v0-15 codemod alone (`npx assistant-ui@latest codemod v0-15/aui-accessor-calls-to-properties ./src`) does not do it.

**Scope accessors are properties.** Calling them still works but is deprecated:

```diff
- aui.thread().getState();
- aui.threads().switchToNewThread();
+ aui.thread.getState();
+ aui.threads.switchToNewThread();
```

Methods *on* a scope keep their parentheses: `aui.thread.composer()`, `aui.thread.message({ index: 0 })`, `aui.message.part({ index: 0 })`.

Selecting an unavailable scope no longer throws. `aui.thread` always succeeds and is always truthy; `source` is `null` when unavailable and any other property read (or a call) throws:

```diff
- try { aui.message; } catch { /* unavailable */ }
+ if (aui.message.source != null) { /* available */ }
```

`source`, `query`, and `name` are reserved accessor property names and never resolve to scope methods.

**Legacy context hooks removed.** Read state with `useAuiState` and take actions with `useAui`:

| Removed | Replacement |
|---------|-------------|
| `useAssistantRuntime()` | `useAui()` |
| `useThreadList(selector)` | `useAuiState((s) => s.threads)` |
| `useThreadRuntime()` | `useAui().thread` |
| `useThread(selector)` | `useAuiState((s) => s.thread)` |
| `useThreadComposer(selector)` | `useAuiState((s) => s.thread.composer)` |
| `useThreadModelContext(selector)` | `useAuiState((s) => s.modelContext)` |
| `useMessageRuntime()` | `useAui().message` |
| `useMessage(selector)` | `useAuiState((s) => s.message)` |
| `useEditComposer(selector)` | `useAuiState((s) => s.message.composer)` |
| `useComposerRuntime()` | `useAui().composer` |
| `useComposer(selector)` | `useAuiState((s) => s.composer)` |
| `useMessagePartRuntime()` | `useAui().part` |
| `useMessagePart(selector)` | `useAuiState((s) => s.part)` |
| `useAttachmentRuntime()` | `useAui().attachment` |
| `useAttachment(selector)` | `useAuiState((s) => s.attachment)` |
| `useThreadListItemRuntime()` | `useAui().threadListItem` |
| `useThreadListItem(selector)` | `useAuiState((s) => s.threadListItem)` |

The attachment variants (`useThreadComposerAttachment(Runtime)`, `useEditComposerAttachment(Runtime)`, `useMessageAttachment(Runtime)`) go with them; use `useAui().attachment` / `useAuiState((s) => s.attachment)`.

**`ToolsState.tools` removed.** `toolUIs` entries carry the renderer alongside its presentation options:

```diff
- const Render = useAuiState((s) => s.tools.tools[toolName]?.[0]);
+ const Render = useAuiState((s) => s.tools.toolUIs[toolName]?.[0]?.render);
```

**`"mcp-app"` group key removed.** `"standalone-tool-call"` is a superset matching MCP-app tool calls plus any tool call whose registered UI opts into standalone display:

```diff
  groupPartByType({
    "tool-call": ["group-tool"],
-   "mcp-app": [],
+   "standalone-tool-call": [],
  })
```

**`useAui(clients, { parent })` second argument removed.** Provide the parent through context:

```diff
- const aui = useAui(scopes, { parent });
+ const Scoped = ({ children }) => {
+   const aui = useAui(scopes); // extends the AuiProvider parent
+   return <AuiProvider value={aui}>{children}</AuiProvider>;
+ };
+ <AuiProvider value={parent}><Scoped /></AuiProvider>
```

Where `{ parent: null }` detached from context, `<AuiProvider value={null}>` now provides an isolated empty root (experimental).

**Public enums are `as const` objects.** The packages adopted `erasableSyntaxOnly`, so exported TypeScript `enum`s became const objects. Value usage is unchanged; `enum`-only type positions may need `(typeof X)[keyof typeof X]`.

**Still deprecated, not yet removed:** primitive `If` components (`ThreadPrimitive.If`, `MessagePrimitive.If`, `ThreadPrimitive.Empty`) in favor of `AuiIf`; `useMessagePartText` / `useMessagePartReasoning` / `useMessagePartSource` / `useMessagePartImage` / `useMessagePartFile` / `useMessagePartData` in favor of selecting and narrowing `s.part`; and the `components` prop on primitives.

## Migration: → 0.14.x (Children API, deprecated removals)

### From 0.13.x

Two themes: APIs deprecated in v0.11/v0.12 are removed, and list primitives move from a `components` prop to a children render function.

**Automatic migration (hook renames):**
```bash
npx assistant-ui@latest upgrade
```

**Removed hook/adapter aliases (find-and-replace):**

| Removed | Replacement |
|---------|-------------|
| `useAssistantApi` | `useAui` |
| `useAssistantState` | `useAuiState` |
| `useAssistantEvent` | `useAuiEvent` |
| `AssistantIf` | `AuiIf` |
| `useLocalThreadRuntime` | `useLocalRuntime` |
| `unstable_useRemoteThreadListRuntime` | `useRemoteThreadListRuntime` |
| `unstable_useCloudThreadListAdapter` | `useCloudThreadListAdapter` |
| `unstable_RemoteThreadListAdapter` | `RemoteThreadListAdapter` |
| `unstable_InMemoryThreadListAdapter` | `InMemoryThreadListAdapter` |

**Runtime API cleanups:**

```diff
- runtime.threadList
+ runtime.threads

- runtime.switchToThread(id)
+ runtime.threads.switchToThread(id)

- runtime.registerModelConfigProvider(p)
+ runtime.registerModelContextProvider(p)

- runtime.reset({ initialMessages })
+ runtime.thread.reset(initialMessages)

- thread.startRun(parentId)
+ thread.startRun({ parentId })

- thread.unstable_resumeRun(config)
+ thread.resumeRun(config)

- thread.unstable_loadExternalState(state)
+ thread.importExternalState(state)

- thread.getModelConfig()
+ thread.getModelContext()
```

**Custom `ChatModelAdapter`:** `options.config` removed, use `options.context`.

```diff
- async run({ messages, config }) { /* config.tools, config.config, ... */ }
+ async run({ messages, context }) { /* context.tools, context.config, ... */ }
```

**State and helpers:**

```diff
- useAuiState((s) => s.message.submittedFeedback)
+ useAuiState((s) => s.message.metadata.submittedFeedback)

- const original = getExternalStoreMessage(threadMessage)
+ const [original] = getExternalStoreMessages(threadMessage)

- import { toAISDKTools } from "@assistant-ui/react"
+ import { toToolsJSONSchema } from "assistant-stream"
```

**react-langgraph:** `useLangGraphRuntime`'s `onSwitchToThread` removed, use `load`.

**Children render functions** (the `components` prop still works but is deprecated):

```diff
- <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage, EditComposer }} />
+ <ThreadPrimitive.Messages>
+   {({ message }) => {
+     if (message.composer.isEditing) return <EditComposer />;
+     if (message.role === "user") return <UserMessage />;
+     return <AssistantMessage />;
+   }}
+ </ThreadPrimitive.Messages>

- <MessagePrimitive.Parts components={{ Text, tools: { Fallback: ToolFallback } }} />
+ <MessagePrimitive.Parts>
+   {({ part }) => {
+     if (part.type === "text") return <MarkdownText />;
+     if (part.type === "tool-call") return part.toolUI ?? <ToolFallback {...part} />;
+     return null;
+   }}
+ </MessagePrimitive.Parts>
```

The same change applies to `ThreadPrimitive.Suggestions`, `ThreadListPrimitive.Items`, and `ComposerPrimitive.Attachments`. Returning `null` from the render function still renders registered tool/data UIs; return `<></>` to render nothing.

**Search for removed patterns:**
```bash
grep -rn "useAssistantApi\|useAssistantState\|useAssistantEvent\|AssistantIf\|unstable_useRemoteThreadListRuntime\|unstable_InMemoryThreadListAdapter\|getExternalStoreMessage\b\|toAISDKTools\|getModelConfig\|onSwitchToThread" --include="*.tsx" --include="*.ts"
```

---

## Migration: → 0.13.x (Top-turn anchoring)

### From 0.12.x

`ThreadPrimitive.ViewportSlack` was removed; top-anchor registration is now automatic on `MessagePrimitive.Root` when `turnAnchor="top"`. Replace `fillClampThreshold` / `fillClampOffset` with `topAnchorMessageClamp` on `ThreadPrimitive.Viewport`:

```diff
- <ThreadPrimitive.ViewportSlack fillClampThreshold="10em" fillClampOffset="6em">
-   ...
- </ThreadPrimitive.ViewportSlack>
+ <ThreadPrimitive.Viewport
+   turnAnchor="top"
+   topAnchorMessageClamp={{ tallerThan: "10em", visibleHeight: "6em" }}
+ >
+   ...
+ </ThreadPrimitive.Viewport>
```

---

## Migration: → 0.12.x (Unified State API)

### From 0.11.x

Unified state API replaces individual context hooks.

**Automatic migration available:**
```bash
npx assistant-ui@latest upgrade
```

**Assistant API hooks renamed (the old names were removed in v0.14):**

```diff
- import { useAssistantApi, useAssistantState, useAssistantEvent, AssistantIf } from "@assistant-ui/react";
+ import { useAui, useAuiState, useAuiEvent, AuiIf } from "@assistant-ui/react";

- const api = useAssistantApi();
+ const aui = useAui();

- const messages = useAssistantState(s => s.thread.messages);
+ const messages = useAuiState(s => s.thread.messages);

- useAssistantEvent("thread.run-start", callback);
+ useAuiEvent("thread.runStart", callback);

- <AssistantIf condition={...}>
+ <AuiIf condition={...}>
```

**Context hooks replaced with unified state API:**

All individual context hooks replaced by `useAuiState` / `useAui`. The right-hand side below is the 0.15 landing form (property accessors), since a project migrating today upgrades past 0.15:

```diff
- const { messages } = useThread();
+ const messages = useAuiState(s => s.thread.messages);

- const runtime = useThreadRuntime();
+ const thread = useAui().thread;

- const { isEditing } = useComposer();
+ const isEditing = useAuiState(s => s.composer.isEditing);

- const runtime = useComposerRuntime();
+ const composer = useAui().composer;

- const { status } = useMessage();
+ const status = useAuiState(s => s.message.status);

- const runtime = useMessageRuntime();
+ const message = useAui().message;
```

Deprecated alongside them and removed outright in 0.15: `useAssistantRuntime`, `useEditComposer`, `useThreadListItem`, `useThreadListItemRuntime`, `useMessagePart`, `useMessagePartRuntime`, `useAttachment`, `useAttachmentRuntime`, `useThreadModelContext`, `useThreadComposer`, `useThreadList`. See the [0.15 section](#migration--015x-property-accessors-legacy-hook-removal) for the full mapping table.

**Event names changed to camelCase:**

| Old | New |
|-----|-----|
| `thread.run-start` | `thread.runStart` |
| `thread.run-end` | `thread.runEnd` |
| `thread.model-context-update` | `thread.modelContextUpdate` |
| `composer.attachment-add` | `composer.attachmentAdd` |
| `thread-list-item.switched-to` | `threadListItem.switchedTo` |
| `thread-list-item.switched-away` | `threadListItem.switchedAway` |

Unchanged: `thread.initialize`, `composer.send`.

**`thread().composer()` invocation (0.12.11):**

```diff
- aui.thread().composer.send();
+ aui.thread().composer().send();
```

**`submitMode` prop (0.12.10), deprecating `submitOnEnter`:**
- `"enter"` (default): submit on Enter
- `"ctrlEnter"`: submit on Ctrl/Cmd+Enter, plain Enter for newlines
- `"none"`: disable keyboard submission

**Zod**: AI SDK v6+ (used by `@assistant-ui/react-ai-sdk` 1.3.x and later) requires `zod@^3.25.76 || ^4.1.8`; both Zod 3.25+ and Zod 4 work.

**New primitives:**
- `ChainOfThoughtPrimitive` (0.12.8)
- `SelectionToolbarPrimitive` (0.12.10)
- `SuggestionPrimitive` (0.12.3)

**`@assistant-ui/core` extraction (0.12.11):**
- Framework-agnostic core extracted to `@assistant-ui/core`
- Shared React code in `@assistant-ui/core/react` (re-exported by `@assistant-ui/react` and `@assistant-ui/react-native`)

**Search for deprecated patterns:**
```bash
grep -rn "useAssistantApi\|useAssistantState\|useAssistantEvent\|AssistantIf\|submitOnEnter\|useThread()\|useComposer()\|useMessage()\|useThreadRuntime\|useComposerRuntime\|useMessageRuntime" --include="*.tsx" --include="*.ts"
```

Add the 0.15 patterns to the same sweep:

```bash
grep -rnE "\b(aui|api)\.(thread|threads|message|part|composer|attachment|threadListItem|modelContext|tools)\(\)" --include="*.tsx" --include="*.ts"
grep -rn "s\.tools\.tools\|\"mcp-app\"" --include="*.tsx" --include="*.ts"
```

---

## Migration: → 0.11.x (Runtime Rearchitecture)

### From 0.10.x

**New unified state API** (hooks renamed to `useAui`/`useAuiState`/`useAuiEvent` in 0.12.x):

```typescript
import {
  useAssistantApi,
  useAssistantState,
  useAssistantEvent
} from "@assistant-ui/react";

// State access (replaces various useThread* hooks)
const messages = useAssistantState(s => s.thread.messages);
const isRunning = useAssistantState(s => s.thread.isRunning);

const api = useAssistantApi();
api.thread().append({ role: "user", content: [{ type: "text", text: "Hello" }] });
api.thread().cancelRun();

useAssistantEvent("composer.send", (e) => {
  console.log("Message sent:", e.messageId);
});
```

**AI SDK v5/v6 support added:**
- Use `useChatRuntime` for AI SDK v6
- `useAISDKRuntime` still works for migration

**Renames:**
- `toolUIs` → `tools` (0.11.39)
- `useLocalThreadRuntime` deprecated, use `useLocalRuntime`

---

## Migration: → 0.10.x (ESM Only)

### From 0.9.x

**BREAKING: CommonJS dropped**

Update bundler if needed:
```json
// package.json
{
  "type": "module"
}
```

Or configure bundler for ESM:
```javascript
// next.config.js
export default {
  experimental: {
    esmExternals: true
  }
}
```

**New APIs:**
- `ContentPart` renamed to `MessagePart` (0.10.25)
- `MessageContent.ToolGroup` added
- `runtime.thread.reset()` added

---

## Migration: → 0.9.x (Edge Split)

### From 0.8.x

**Edge package split:**
- Edge runtime utilities moved to separate entry points
- Check imports if using edge runtime

---

## Migration: → 0.8.x (UI Split)

### From 0.7.x

**BREAKING: Pre-styled UI moved out of `@assistant-ui/react`**

0.7.x: `Thread` etc. were re-exported from `@assistant-ui/react` via `./ui` subpath
0.8.0+: Use shadcn/ui registry (recommended) or `@assistant-ui/react-ui` (legacy, not maintained)

**Option 1: shadcn/ui Registry (Recommended)**

```bash
# Using assistant-ui CLI
npx assistant-ui add thread thread-list

# Or using shadcn CLI
npx shadcn@latest add "https://r.assistant-ui.com/thread"
```

Components are copied to your project (e.g., `components/assistant-ui/thread.tsx`).

```diff
// Styled components - now local files
// Note: ThreadWelcome is now embedded inside Thread (shows when thread is empty)
- import { Thread, ThreadWelcome } from "@assistant-ui/react";
+ import { Thread } from "@/components/assistant-ui/thread";

// Primitives remain in @assistant-ui/react (no change)
import { ThreadPrimitive } from "@assistant-ui/react";
```

**Option 2: Legacy Package (Not Recommended)**

`@assistant-ui/react-ui` exists but is not actively maintained.

**Search for imports to update:**
```bash
grep -r "from ['\"]@assistant-ui/react['\"]" --include="*.tsx" --include="*.ts" | grep -v "Primitive"
```

**setResult/setArtifact merged (0.8.18):**
```diff
- tool.setResult(result);
- tool.setArtifact(artifact);
+ tool.setResponse({ result, artifact });
```

---

## Migration: → 0.7.x (Thread API)

### From 0.6.x or 0.5.x

**BREAKING (0.7.44): Thread API moved**

```diff
- runtime.switchToThread(threadId);
+ runtime.threads.switchToThread(threadId);

- runtime.switchToNewThread();
+ runtime.threads.switchToNewThread();

- runtime.threadList
+ runtime.threads
```

**Search:**
```bash
grep -r "runtime\.switchToThread\|runtime\.switchToNewThread\|runtime\.threadList" --include="*.tsx" --include="*.ts"
```

**Deprecated features dropped (0.7.0):**
- All previously deprecated APIs removed
- `ThreadListItemPrimitive` introduced

---

## Migration: → 0.5.x (Runtime API)

### From 0.4.x

**maxToolRoundtrips → maxSteps (0.5.74):**
```diff
- maxToolRoundtrips: 5,
+ maxSteps: 5,
```

**New Runtime API introduced (0.5.61+):**
- `ThreadRuntime.Composer`
- Status/attachments/metadata on all messages

---

## Migration: → 0.4.x (Message Types)

### From 0.3.x

**BREAKING: Message type renames**

```diff
- import type { AssistantMessage, UserMessage } from "@assistant-ui/react";
+ import type { ThreadAssistantMessage, ThreadUserMessage } from "@assistant-ui/react";
```

**Search:**
```bash
grep -r "AssistantMessage\|UserMessage" --include="*.tsx" --include="*.ts" | grep -v "Thread"
```

**System message support added**

---

## Migration: → 0.3.x

### From 0.2.x

**BREAKING: Message.InProgress dropped**
- Use message status instead of `Message.InProgress`

---

## Migration: → 0.2.x

### From 0.1.x

**BREAKING: MessagePartText renders as `<p>`**
- Text parts now wrapped in paragraph element
- Adjust CSS if needed

---

## Automated Search Commands

Find patterns that need updating:

```bash
# Old thread API
grep -rn "runtime\.switchToThread\|runtime\.threadList" --include="*.tsx" --include="*.ts"

# Old message types
grep -rn "AssistantMessage\[^C\]\|UserMessage\[^C\]" --include="*.tsx" --include="*.ts"

# Old tool API
grep -rn "setResult\|setArtifact" --include="*.tsx" --include="*.ts"

# Styled imports (need shadcn registry migration)
grep -rn "from ['\"]@assistant-ui/react['\"]" --include="*.tsx" | grep -v "Primitive\|Runtime\|use"
```

## Verification

After migration:

```bash
# Type check
npx tsc --noEmit

# Build
pnpm build

# Test
pnpm test
```

Manual verification:
- [ ] App starts
- [ ] Chat renders
- [ ] Messages send/receive
- [ ] Tools work
- [ ] Thread switching works
