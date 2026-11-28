# MCP config UI

Headless primitives for letting end users add and authenticate MCP servers from the browser, plus the `McpConfigDialog` shadcn registry component built on them.

The primitives ship from `@assistant-ui/react-mcp`. Per-server card and form state is read with `useAuiState` from `@assistant-ui/store`. Install the prebuilt dialog with the CLI (`https://r.assistant-ui.com/mcp-config.json`) to get a ready styled version under `@/components/assistant-ui/mcp-config` that you can edit.

## Contents

- [Imports](#imports)
- [McpManagerPrimitive](#mcpmanagerprimitive)
- [McpServerPrimitive](#mcpserverprimitive)
- [McpAddFormPrimitive](#mcpaddformprimitive)
- [MCPConnectionState](#mcpconnectionstate)
- [Reading server state](#reading-server-state)
- [McpConfigDialog](#mcpconfigdialog)

## Imports

```tsx
import { useAuiState } from "@assistant-ui/store";
import {
  McpAddFormPrimitive,
  McpManagerPrimitive,
  McpServerPrimitive,
  type MCPConnectionState,
} from "@assistant-ui/react-mcp";
```

## McpManagerPrimitive

Wraps the manager state and iterates over the two server collections. The iteration parts take a render-prop child `() => <ServerCard />`; each rendered card reads its own server from context.

| Part | Props | Description |
|------|-------|-------------|
| `.Root` | | Manager context provider; wrap the whole UI |
| `.Connectors` | | App-defined connectors; child is `() => ReactNode` |
| `.CustomServers` | | User-added servers; child is `() => ReactNode` |
| `.AddCustomTrigger` | `asChild` | Reveals the add form |

```tsx
<McpManagerPrimitive.Root>
  <section>
    <h3>Connectors</h3>
    <McpManagerPrimitive.Connectors>
      {() => <ServerCard />}
    </McpManagerPrimitive.Connectors>
  </section>

  <section>
    <h3>Custom servers</h3>
    <McpManagerPrimitive.CustomServers>
      {() => <ServerCard />}
    </McpManagerPrimitive.CustomServers>

    <McpManagerPrimitive.AddCustomTrigger asChild>
      <Button>Add server</Button>
    </McpManagerPrimitive.AddCustomTrigger>
  </section>
</McpManagerPrimitive.Root>
```

## McpServerPrimitive

Renders a single server (the one provided by the surrounding `.Connectors` / `.CustomServers` iteration). The connect, authorize, and disconnect actions render conditionally based on the server's connection state, so include all three and let the primitive decide which is active.

| Part | Props | Description |
|------|-------|-------------|
| `.Root` | `className` | Card container; exposes `data-connection-state` (e.g. `data-[connection-state=error]`) |
| `.Name` | | Renders the server name |
| `.ConnectButton` | `asChild` | Connects a server that uses no OAuth |
| `.OAuthLink` | `className` | Starts the OAuth flow (renders as a link) |
| `.DisconnectButton` | `asChild` | Disconnects a connected server |
| `.RemoveButton` | `asChild` | Removes the server from the manager |

```tsx
const ServerCard: FC = () => (
  <McpServerPrimitive.Root
    className={cn(
      "rounded-lg border p-3",
      "data-[connection-state=error]:border-destructive/40",
    )}
  >
    <McpServerPrimitive.Name />
    <McpServerPrimitive.ConnectButton asChild>
      <Button size="sm">Connect</Button>
    </McpServerPrimitive.ConnectButton>
    <McpServerPrimitive.OAuthLink className={cn(buttonVariants({ size: "sm" }))}>
      Authorize
    </McpServerPrimitive.OAuthLink>
    <McpServerPrimitive.DisconnectButton asChild>
      <Button size="sm" variant="outline">Disconnect</Button>
    </McpServerPrimitive.DisconnectButton>
    <McpServerPrimitive.RemoveButton asChild>
      <Button variant="ghost" size="icon"><Trash2Icon className="size-4" /></Button>
    </McpServerPrimitive.RemoveButton>
  </McpServerPrimitive.Root>
);
```

## McpAddFormPrimitive

The form for adding a custom server. `.Root` owns the form state and fires `onSubmitted` after a successful add and `onCancel` when dismissed; both are handy for closing the form. `.AuthSelect` chooses the auth scheme and `.AuthFields` renders whatever inputs that scheme needs (for example a bearer token field).

| Part | Props | Description |
|------|-------|-------------|
| `.Root` | `onSubmitted`, `onCancel` | Form provider and submit handler |
| `.NameField` | `asChild` | Server name input |
| `.UrlField` | `asChild` | Server URL input |
| `.AuthSelect` | `className` | Auth scheme `<select>` |
| `.AuthFields` | | Inputs required by the selected scheme |
| `.Error` | `className` | Validation / submit error text |
| `.Submit` | `asChild` | Submits the form |
| `.Cancel` | `asChild` | Cancels and fires `onCancel` |

```tsx
const AddServerForm: FC<{ onClose: () => void }> = ({ onClose }) => (
  <McpAddFormPrimitive.Root onSubmitted={onClose} onCancel={onClose}>
    <McpAddFormPrimitive.NameField asChild>
      <Input placeholder="My MCP server" />
    </McpAddFormPrimitive.NameField>
    <McpAddFormPrimitive.UrlField asChild>
      <Input placeholder="https://example.com/mcp" />
    </McpAddFormPrimitive.UrlField>
    <McpAddFormPrimitive.AuthSelect className="h-9 w-full rounded-md border px-2 text-sm" />
    <McpAddFormPrimitive.AuthFields />
    <McpAddFormPrimitive.Error className="text-destructive text-xs" />
    <McpAddFormPrimitive.Cancel asChild>
      <Button type="button" variant="ghost" size="sm">Cancel</Button>
    </McpAddFormPrimitive.Cancel>
    <McpAddFormPrimitive.Submit asChild>
      <Button type="submit" size="sm">Add server</Button>
    </McpAddFormPrimitive.Submit>
  </McpAddFormPrimitive.Root>
);
```

## MCPConnectionState

Union of the six states a server can be in; useful for mapping status to a label or badge variant.

```ts
type MCPConnectionState =
  | "connected"
  | "connecting"
  | "authRequired"
  | "authPending"
  | "error"
  | "disconnected";
```

## Reading server state

Inside a `McpServerPrimitive.Root` (or any `.Connectors` / `.CustomServers` child) read the current server from the store via `s.mcpServer`.

```tsx
const icon = useAuiState((s) => s.mcpServer.icon ?? null);
const name = useAuiState((s) => s.mcpServer.name);
const status = useAuiState((s) => s.mcpServer.connectionState);
const message = useAuiState((s) => s.mcpServer.lastError?.message ?? null);
```

## McpConfigDialog

The registry component is a shadcn dialog that lists connectors and custom servers with inline auth controls and an add form, composing every primitive above. Its only prop is `children`, which overrides the default trigger button.

```ts
export namespace McpConfigDialog {
  export type Props = { children?: ReactNode };
}
```

```tsx
import { McpConfigDialog } from "@/components/assistant-ui/mcp-config";

// default trigger ("MCP servers" button)
<McpConfigDialog />

// custom trigger
<McpConfigDialog>
  <Button variant="ghost">Servers</Button>
</McpConfigDialog>
```

The dialog reads connectors and custom servers from the MCP manager resource on the runtime, so render it inside the same provider tree as your `AuiProvider`. See [setup.md](./setup.md) for mounting `McpManagerResource`.
