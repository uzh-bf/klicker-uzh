# MCP Server Tools

Connect MCP servers as a server-side tool catalog: create a client in your AI SDK route, spread its tools into `streamText`, and render results with the existing tool-call UI.

## Contents

- [How it works](#how-it-works)
- [Install](#install)
- [Connect to a server](#connect-to-a-server)
- [Wire tools into the route](#wire-tools-into-the-route)
- [Combine multiple servers](#combine-multiple-servers)
- [Render results](#render-results)
- [Notes](#notes)

## How it works

MCP is an open protocol for exposing tools, resources, and prompts to LLMs. One server can publish many tools (file system, GitHub, Slack, your own service). The AI SDK ships a built-in MCP client that lives on the server inside your route handler:

```
client ──► /api/chat ──► MCP client ──► MCP server (HTTP, SSE, stdio)
                              │
                              └─ tools() ──► passed to streamText({ tools })
```

The client connects to one or more MCP servers, calls `tools()` to get a tool map, and hands that map to `streamText`. assistant-ui's existing tool-call UI (`ToolFallback`, `makeAssistantToolUI`) renders the results.

Note: this is the server-side wiring guide. For a client where the user adds and manages their own MCP servers from the browser, see the react-mcp reference instead.

## Install

```
npm install @ai-sdk/mcp
```

For stdio transports (local dev only), also install the official MCP SDK:

```
npm install @modelcontextprotocol/sdk
```

## Connect to a server

Set the server URL and any auth token your server requires:

```
# .env.local
MCP_SERVER_URL=https://your-mcp-server.example/mcp
MCP_TOKEN=...
```

Create the client with the transport that matches your server. HTTP is the production transport; SSE is the legacy streaming transport; stdio spawns a local process and is dev-only.

```ts
// app/api/chat/route.ts
import { createMCPClient } from "@ai-sdk/mcp";

const mcpClient = await createMCPClient({
  transport: {
    type: "http",
    url: process.env.MCP_SERVER_URL!,
    headers: { Authorization: `Bearer ${process.env.MCP_TOKEN}` },
  },
});
```

For stdio:

```ts
import { createMCPClient } from "@ai-sdk/mcp";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const mcpClient = await createMCPClient({
  transport: new StdioClientTransport({
    command: "node",
    args: ["./mcp-server/dist/index.js"],
  }),
});
```

## Wire tools into the route

`mcpClient.tools()` returns an object shaped exactly like the `tools` argument of `streamText`. Spread it in alongside any of your own tools, and close the client when the response finishes:

```ts
// app/api/chat/route.ts
import { createMCPClient } from "@ai-sdk/mcp";
import { openai } from "@ai-sdk/openai";
import {
  streamText,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
} from "ai";
import type { UIMessage } from "ai";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const mcpClient = await createMCPClient({
    transport: {
      type: "http",
      url: process.env.MCP_SERVER_URL!,
      headers: { Authorization: `Bearer ${process.env.MCP_TOKEN}` },
    },
  });

  const tools = await mcpClient.tools();

  const result = streamText({
    model: openai("gpt-5.4-mini"),
    messages: await convertToModelMessages(messages),
    tools,
    onFinish: async () => {
      await mcpClient.close();
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
```

`onFinish` is the right place to call `close()`: it fires after the stream completes, so the connection stays open as long as the model is still calling tools.

## Combine multiple servers

Each server has its own client. Spread their tool maps together:

```ts
const githubClient = await createMCPClient({
  transport: { type: "http", url: process.env.GITHUB_MCP_URL! },
});
const filesClient = await createMCPClient({
  transport: { type: "http", url: process.env.FILES_MCP_URL! },
});

const tools = {
  ...(await githubClient.tools()),
  ...(await filesClient.tools()),
};
// remember to close both in onFinish
```

If two servers expose tools with the same name, the later spread wins. Rename or scope as needed.

## Render results

Tool calls flow through the existing assistant-ui tool-call rendering. With no setup, the bundled `<ToolFallback>` component renders the call name, arguments, and result. To customize the appearance for a specific tool, use `makeAssistantToolUI`:

```tsx
// app/components/GitHubIssueToolUI.tsx
"use client";
import { makeAssistantToolUI } from "@assistant-ui/react";

type Args = { repo: string; number: number };
type Result = { title: string; state: string; url: string };

export const GitHubIssueToolUI = makeAssistantToolUI<Args, Result>({
  toolName: "github_get_issue",
  render: ({ args, result }) => (
    <div className="rounded border p-3">
      <div className="font-mono text-sm">
        {args.repo}#{args.number}
      </div>
      {result && (
        <a href={result.url} className="underline">
          {result.title} ({result.state})
        </a>
      )}
    </div>
  ),
});
```

Mount it once anywhere inside `<AssistantRuntimeProvider>`. The `toolName` must match the name your MCP server publishes. The same `makeAssistantToolUI` API ships from `@assistant-ui/react-native` and `@assistant-ui/react-ink` with platform-appropriate primitives.

To verify: trigger a tool call and confirm the call appears with the expected arguments, the result renders (custom `ToolUI` or fallback), and connections do not accumulate. If they do, check `onFinish`.

## Notes

- Server-side only. The MCP client uses Node APIs (sockets, optionally child processes). Never instantiate it in client code.
- Per-request lifecycle. A fresh client per request keeps connection state simple. For high-throughput servers, pool clients yourself with care: `tools()` assumes the connection is alive when `streamText` runs.
- Sampling. If your MCP server uses `sampling/createMessage` (lets the server ask the LLM mid-call), assistant-cloud users can instrument it via `instrumentMcpSampling` for observability. This is independent of the wiring above.
- Transport choice. HTTP for any networked server. SSE only if the server doesn't speak HTTP. stdio is for local development against an MCP server in your monorepo.
