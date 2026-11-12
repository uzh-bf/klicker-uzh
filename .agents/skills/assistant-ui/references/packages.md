# assistant-ui Packages

## Published Packages

**To check latest version:** Run `npm view <package-name> version` or check the package on npmjs.com.

- Most published packages only expose the `latest` dist-tag; always install from `latest`.
- Monorepo-only (not on npm): `@assistant-ui/x-buildutils`, `@assistant-ui/ui`.

### Core

| Package | Notes |
|---------|-------|
| `@assistant-ui/react` | Core UI library: primitives, hooks, runtimes |
| `@assistant-ui/core` | Framework-agnostic core runtime shared by every binding |
| `@assistant-ui/store` | Tap-based state management (`useAui`, `AuiProvider`) |
| `@assistant-ui/tap` | Reactive state primitives inspired by React hooks |
| `assistant-stream` | Streaming protocol and encoders/decoders |
| `assistant-cloud` | Cloud persistence and auth client |
| `assistant-ui` | CLI (`create`, `init`, `add`, `update`, `upgrade`, `doctor`, `mcp`, `agent`) |
| `create-assistant-ui` | `npm create assistant-ui` scaffolding entry point |

### Platform bindings

| Package | Notes |
|---------|-------|
| `@assistant-ui/react-native` | React Native / Expo bindings |
| `@assistant-ui/react-ink` | React Ink terminal-UI bindings |
| `@assistant-ui/react-ink-markdown` | Terminal markdown rendering for react-ink |
| `@assistant-ui/next` | Next.js integration: `withAui()` config wrapper, `"use generative"` compiler |
| `@assistant-ui/vite` | Vite plugin for the `"use generative"` directive compiler |
| `@assistant-ui/metro` | Metro / Expo integration for the `"use generative"` compiler |

### Backend adapters

| Package | Notes |
|---------|-------|
| `@assistant-ui/react-ai-sdk` | Vercel AI SDK adapter (v7 current; v6/v5 via pinned older releases) |
| `@assistant-ui/react-langchain` | LangChain `useStream` adapter (the `langchain` CLI template uses this) |
| `@assistant-ui/react-langgraph` | LangGraph adapter |
| `@assistant-ui/react-ag-ui` | AG-UI protocol adapter |
| `@assistant-ui/react-a2a` | A2A (Agent-to-Agent) v1.0 protocol adapter |
| `@assistant-ui/react-google-adk` | Google ADK adapter |
| `@assistant-ui/react-opencode` | OpenCode runtime adapter |
| `@assistant-ui/react-pi` | Pi coding-agent runtime adapter |
| `@assistant-ui/eve` | Eve runtime adapter |
| `@assistant-ui/react-data-stream` | AI SDK v4 data-stream adapter (legacy path) |
| `@assistant-ui/cloud-ai-sdk` | Standalone AI SDK hooks backed by Assistant Cloud persistence |

### UI and rendering

| Package | Notes |
|---------|-------|
| `@assistant-ui/react-markdown` | Markdown rendering (`MarkdownTextPrimitive`) |
| `@assistant-ui/react-streamdown` | Streamdown rendering with built-in Shiki/KaTeX/Mermaid |
| `@assistant-ui/react-syntax-highlighter` | Code block highlighting adapters |
| `@assistant-ui/react-lexical` | Lexical rich-text composer with @-mention support |
| `@assistant-ui/react-generative-ui` | Declarative generative UI (UISpec, A2UI, Slack/Teams converters) |
| `@assistant-ui/react-hook-form` | React Hook Form integration |
| `safe-content-frame` | Sandboxed iframe rendering for untrusted content |
| `heat-graph` | Headless activity heatmap components |
| `tw-shimmer` | Tailwind CSS v4 shimmer plugin |
| `tw-glass` | Tailwind CSS v4 glass refraction plugin |

### Tooling and integrations

| Package | Notes |
|---------|-------|
| `@assistant-ui/react-mcp` | User-managed MCP server connection/config primitives |
| `@assistant-ui/react-devtools` | DevTools panel and modal |
| `@assistant-ui/react-o11y` | Span/trace rendering primitives |
| `@assistant-ui/mcp-docs-server` | MCP server exposing assistant-ui docs to an IDE |
| `@assistant-ui/agent-launcher` | Spawns the Claude Code CLI with a chosen plugin, skill, and prompt |
| `@assistant-ui/x-generative-compiler` | Internal `"use generative"` compiler shared by next/vite/metro |

## Core Packages

### @assistant-ui/react

Main UI library with primitives and hooks. Requires React 18 or 19.

```bash
npm install @assistant-ui/react
```

**Exports:**
- Primitives: `ThreadPrimitive`, `MessagePrimitive`, `ComposerPrimitive`, `ActionBarPrimitive`, `ActionBarMorePrimitive`, `BranchPickerPrimitive`, `AttachmentPrimitive`, `ThreadListPrimitive`, `ThreadListItemPrimitive`, `ThreadListItemMorePrimitive`, `MessagePartPrimitive`, `ChainOfThoughtPrimitive`, `SelectionToolbarPrimitive`, `SuggestionPrimitive`, `QueueItemPrimitive`, `ErrorPrimitive`, `AssistantModalPrimitive`
- Pre-built components come from the registry (`npx assistant-ui@latest add thread`), landing in `@/components/assistant-ui/*`
- Hooks: `useAui`, `useAuiState`, `useAuiEvent`, `useAuiToolOverrides`
- Conditionals: `AuiIf`, `AuiProvider`
- Runtimes: `useLocalRuntime`, `useExternalStoreRuntime`, `useRemoteThreadListRuntime`, `useAssistantTransportRuntime`
- Tools: `tool`, `defineToolkit`, `Tools`, `makeAssistantTool`, `makeAssistantToolUI`, `useAssistantTool`, `useAssistantToolUI`, `hitl`, `humanTool`, `providerTool`, `externalTool`, `stubTool`
- Copilots: `useAssistantInstructions`, `useAssistantContext`, `makeAssistantVisible`, `Interactables`
- Provider: `AssistantRuntimeProvider`

### assistant-stream

Streaming protocol for AI responses.

```bash
npm install assistant-stream
```

**Exports:**
- `AssistantStream`, `createAssistantStream`, `createAssistantStreamResponse` - Core streaming abstraction
- `DataStreamEncoder` / `DataStreamDecoder` - AI SDK format
- `AssistantTransportEncoder` / `AssistantTransportDecoder` - Native format
- `PlainTextEncoder` / `PlainTextDecoder` - Simple text streaming
- `UIMessageStreamDecoder`, `SSEEventDecoder` - AI SDK UI-message stream and raw SSE decoding
- `createObjectStream`, `fromObjectStreamResponse`, `parsePartialJsonObject` - Object/state streaming
- `toToolsJSONSchema` - Serialize a tool map to JSON Schema

Subpaths: `assistant-stream/utils` (JSON helpers) and `assistant-stream/resumable` (plus `/resumable/redis` and `/resumable/ioredis` stores).

### assistant-cloud

Cloud persistence and auth.

```bash
npm install assistant-cloud
```

**Exports:**
- `AssistantCloud` - Main client class
- `cloud.threads` (list, get, create, update, delete, `messages(threadId)`), `cloud.projects`, `cloud.runs`, `cloud.files`, `cloud.auth`, `cloud.telemetry`

## Integration Packages

### @assistant-ui/react-ai-sdk

Vercel AI SDK adapter. 1.4.x targets AI SDK v7.

```bash
npm install @assistant-ui/react-ai-sdk ai@^7 @ai-sdk/react@^4
```

**Exports:**
- `useChatRuntime` - Main hook (recommended); defaults to `AssistantChatTransport`
- `useAISDKRuntime` - Wraps a `useChat` instance you own
- `AssistantChatTransport` - Transport that forwards system messages and frontend tools
- `frontendTools` - Materializes forwarded frontend tools in the backend route
- `AISDKToolkit`, `generativeTools` - Toolkit and generative-UI tool bridges
- `useThreadTokenUsage`, `getThreadMessageTokenUsage` - Token accounting
- `useAISDKChat`, `useAISDKError` - Runtime extras accessors
- `createResumableSessionStorage`, `RESUMABLE_STREAM_ID_HEADER` - Resumable streams
- `injectQuoteContext` - Composer quote plumbing

### @assistant-ui/react-langgraph

LangGraph agent integration.

```bash
npm install @assistant-ui/react-langgraph
```

**Exports:**
- `useLangGraphRuntime` - Main hook
- `useLangGraphSend`, `useLangGraphSendCommand` - Manual send control
- `useLangGraphInterruptState` - Interrupt state access
- `useLangGraphMessages` - Message state management
- `useLangGraphState`, `useLangGraphSetState` - Shared agent state
- `useLangGraphUIMessages`, `useLangGraphMessageMetadata`, `useLangGraphStreamingTiming`
- `convertLangChainMessages`, `appendLangChainChunk` - Message converters
- `LangGraphMessageAccumulator` - Message accumulator

### @assistant-ui/react-ag-ui

AG-UI protocol adapter.

```bash
npm install @assistant-ui/react-ag-ui
```

**Exports:**
- `useAgUiRuntime` - Main hook
- `useAgUiState`, `useAgUiSetState` - Shared agent state
- `useAgUiInterrupts`, `useAgUiSubmitInterruptResponses`, `useAgUiSteerAway` - Interrupt handling
- `useAgUiSendA2uiAction` - A2UI surface actions
- `fromAgUiMessages` - Message converter

## UI Enhancement Packages

### @assistant-ui/react-markdown

Markdown rendering with syntax highlighting support.

```bash
npm install @assistant-ui/react-markdown
```

**Exports:**
- `MarkdownTextPrimitive` - Renders markdown content
- `useIsMarkdownCodeBlock` - Check if code block is inside markdown
- `unstable_memoizeMarkdownComponents` - Memoize markdown components for performance
- `normalizeMathDelimiters`, `rewriteLatexBracketDelimiters`, `escapeCurrencyDollars` - Math preprocessing helpers

### @assistant-ui/react-syntax-highlighter

Code block syntax highlighting.

```bash
npm install @assistant-ui/react-syntax-highlighter
```

## Package Selection Guide

| Scenario | Packages |
|----------|----------|
| Next.js + AI SDK | `@assistant-ui/react`, `@assistant-ui/react-ai-sdk`, `ai@^7`, `@ai-sdk/react@^4` |
| LangGraph | `@assistant-ui/react`, `@assistant-ui/react-langchain` (or `@assistant-ui/react-langgraph`) |
| Custom backend | `@assistant-ui/react`, `assistant-stream` |
| With markdown | Add `@assistant-ui/react-markdown` or `@assistant-ui/react-streamdown` |
| Expo / React Native | `@assistant-ui/react-native`, `@assistant-ui/metro` |
| Terminal UI | `@assistant-ui/react-ink`, `@assistant-ui/react-ink-markdown` |
| Production persistence | Add `assistant-cloud` |

## Version Compatibility

- `@assistant-ui/react` requires React 18 or 19 (`react@^18 || ^19`)
- `@assistant-ui/react-ai-sdk` 1.4.x depends on AI SDK v7 (`ai@^7`, `@ai-sdk/react@^4`). Older AI SDK majors need a pinned adapter release: `1.3.40` for `ai@^6`, `1.1.21` for `ai@^5`, and `@assistant-ui/react-data-stream` for `ai@^4`.
- AI SDK requires `zod@^3.25.76 || ^4.1.8`; both Zod 3.25+ and Zod 4 work
- Node.js >=24 is only required to build the assistant-ui monorepo itself; consuming apps follow their framework's Node requirement
