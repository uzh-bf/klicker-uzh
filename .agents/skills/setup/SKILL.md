---
name: setup
description: "Installs and configures assistant-ui in a project via the CLI, and picks the right runtime for a backend. Use for first-time install, scaffold, or config: `npx assistant-ui@latest create my-app` (templates default, minimal, cloud, cloud-clerk, langchain, mcp, eve), `npx assistant-ui@latest init [--yes] [--overwrite]` in an existing Next.js app, or `npx assistant-ui@latest add` registry components (thread, markdown-text, thread-list, tool-fallback). Also covers the other CLI verbs: doctor, info, update, upgrade, mcp, and agent. Use to choose a runtime hook for a backend: useChatRuntime (AI SDK v7), useLangGraphRuntime, useAgUiRuntime, useA2ARuntime, useLocalRuntime (custom streaming API), or useExternalStoreRuntime (Redux/Zustand). Covers Vite/TanStack Start setup, Expo (--native) and React Ink (--ink) scaffolds, shadcn and Base UI registry styles, the playground --preset flag, and avoiding the deprecated @assistant-ui/styles and @assistant-ui/react-ui packages. For upgrading an existing install or post-upgrade breakage use update; for building UI from raw parts use primitives."
license: MIT
---

# assistant-ui Setup

**Always consult [assistant-ui.com/llms.txt](https://www.assistant-ui.com/llms.txt) for the latest API.**

## CLI Commands

### Quick Decision Flow

- Existing Next.js app (`package.json` exists): use `npx assistant-ui@latest init`
- Existing app in CI/agent/non-interactive shell: use `npx assistant-ui@latest init --yes`
- Existing app + force overwrite of conflicts: add `--overwrite`
- New app / empty directory: use `npx assistant-ui@latest create <name>`
- Need specific starter template: add `-t <default|minimal|cloud|cloud-clerk|langchain|mcp|eve>`
- Need a curated example: use `npx assistant-ui@latest create <name> --example <example>`
- Need playground preset config: use `npx assistant-ui@latest create <name> --preset <name-or-url>`
- Expo / React Native app: `npx assistant-ui@latest create <name> --native`
- Terminal (React Ink) app: `npx assistant-ui@latest create <name> --ink`

### New Project (`create`)

```bash
npx assistant-ui@latest create my-app -t minimal
npx assistant-ui@latest create my-app -t cloud-clerk
npx assistant-ui@latest create my-app --preset chatgpt
```

Templates:

| Template | Description |
|-------|-------|
| `default` | Default template with Vercel AI SDK |
| `minimal` | Bare-bones starting point |
| `cloud` | Cloud-backed persistence starter |
| `cloud-clerk` | Cloud-backed starter with Clerk auth |
| `langchain` | LangGraph starter using the `@assistant-ui/react-langchain` adapter |
| `mcp` | MCP tools + MCP Apps renderer starter |
| `eve` | Eve agent + Next.js starter |

There is no `langgraph` template; that path is now the `langchain` template (or the `with-langgraph` example for the `@assistant-ui/react-langgraph` adapter directly).

Examples (`--example <name>`) currently include: `with-ag-ui`, `with-ai-sdk-v7`, `with-artifacts`, `with-assistant-transport`, `with-chain-of-thought`, `with-cloud`, `with-custom-thread-list`, `with-elevenlabs-conversational`, `with-elevenlabs-scribe`, `with-eve`, `with-expo`, `with-external-store`, `with-ffmpeg`, `with-google-adk`, `with-interactables`, `with-langgraph`, `with-livekit`, `with-react-hook-form`, `with-react-ink`, `with-react-router`, `with-resumable-stream`, `with-tanstack`.

Other `create` flags: `--use-npm` / `--use-pnpm` / `--use-yarn` / `--use-bun`, `--skip-install`, and `--skills` / `--no-skills` (installs the assistant-ui agent skills for AI coding assistants; defaults to on in a non-TTY shell).

When `-t` is omitted:
- Interactive shell (TTY): an interactive template picker is shown.
- Non-interactive shell (CI/agent): template defaults to `default`.

If no project directory is provided in a non-interactive shell, `create` uses `my-aui-app`.

### Existing Next.js Project (`init`)

```bash
npx assistant-ui@latest init --yes
```

The `init` command is for **existing projects only** (requires `package.json`).
If no project is found, it automatically forwards to `create`.
Passing `--preset` to `init` also forwards to `create` (compatibility path).

The `--yes` flag runs non-interactively (no prompts).

### Add Registry Components

```bash
npx assistant-ui@latest add thread
npx assistant-ui@latest add markdown-text
npx assistant-ui@latest add thread-list
```

Registry: `https://r.assistant-ui.com/{name}.json`

See [references/registry-components.md](./references/registry-components.md) for the full item list.

### Other CLI Commands

| Command | Purpose |
|---------|---------|
| `assistant-ui doctor` | Diagnose an existing install (version drift, misconfiguration); `--no-network` skips the registry check |
| `assistant-ui info` | Print environment and package information for bug reports |
| `assistant-ui update` | Bump assistant-ui packages to their latest versions (`--dry` prints the command) |
| `assistant-ui upgrade` | Run the version codemods (`-d` dry run, `-p` print transformed files) |
| `assistant-ui mcp` | Install the MCP docs server for Cursor, Windsurf, VSCode, Zed, Claude Code, or Claude Desktop |
| `assistant-ui agent "<prompt>"` | Launch Claude Code preloaded with the assistant-ui skills (`--dry` prints the command) |

---

## Template Code Policy

When using CLI templates (`npx assistant-ui@latest create`), **never modify generated code** unless explicitly requested.

---

## Non-Default Setups

For runtimes other than AI SDK or frameworks other than Next.js, consult the reference files:

| Setup | Runtime Hook | Reference |
|-------|-------------|-----------|
| AI SDK advanced (tools, cloud, options) | `useChatRuntime` | [references/ai-sdk.md](./references/ai-sdk.md) |
| Styling and UI customization (shadcn / Base UI pattern) | n/a | [references/styling.md](./references/styling.md) |
| LangGraph agents | `useLangGraphRuntime` | [references/langgraph.md](./references/langgraph.md) |
| AG-UI protocol | `useAgUiRuntime` | [references/ag-ui.md](./references/ag-ui.md) |
| A2A protocol | `useA2ARuntime` | [references/a2a.md](./references/a2a.md) |
| Custom streaming API | `useLocalRuntime` | [references/custom-backend.md](./references/custom-backend.md) |
| Existing state (Redux/Zustand) | `useExternalStoreRuntime` | [references/custom-backend.md](./references/custom-backend.md) |
| Vite / TanStack Start | n/a | [references/tanstack.md](./references/tanstack.md) |
| LangChain agents | `useStreamRuntime` | [references/langchain.md](./references/langchain.md) |
| Google ADK agents | `useAdkRuntime` | [references/google-adk.md](./references/google-adk.md) |
| Mastra agents | `useChatRuntime` | [references/mastra.md](./references/mastra.md) |
| Cloudflare Agents | `useAISDKRuntime` | [references/cloudflare-agents.md](./references/cloudflare-agents.md) |
| Legacy AI SDK v4/v5/v6 | pinned adapter release | [references/ai-sdk-legacy.md](./references/ai-sdk-legacy.md) |
| Registry UI components (modal, sidebar, model selector) | registry | [references/registry-components.md](./references/registry-components.md) |
| DevTools inspector | dev only | [references/devtools.md](./references/devtools.md) |

Runtime adapters with no reference file here (consult the docs site): `@assistant-ui/react-opencode` (`useOpenCodeRuntime`), `@assistant-ui/react-pi`, and `@assistant-ui/eve` (the `eve` template).

### Platform targets

| Target | Package | Scaffold |
|--------|---------|----------|
| Web (React) | `@assistant-ui/react` | `create` |
| Expo / React Native | `@assistant-ui/react-native` + `@assistant-ui/metro` | `create <name> --native` |
| Terminal | `@assistant-ui/react-ink` + `@assistant-ui/react-ink-markdown` | `create <name> --ink` |

---

## Deprecated Packages

NEVER install `@assistant-ui/styles` or `@assistant-ui/react-ui`; both are deprecated and deleted.

---

## Troubleshooting

For issues not covered by the reference files, use the docs website:

1. **Fetch the index**: `https://www.assistant-ui.com/llms.txt` (compact table of contents)
2. **Fetch specific pages**: Append `.mdx` to the docs URL, e.g. `https://www.assistant-ui.com/docs/runtimes/ai-sdk.mdx`
