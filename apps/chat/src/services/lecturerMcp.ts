import {
  mintLecturerMcpJwt,
  resolveLecturerMcpScope,
} from '@/src/lib/server/mcpAuthMint'
import { experimental_createMCPClient as createSDKMCPClient } from '@ai-sdk/mcp'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { ToolSet } from 'ai'
import { buildMcpServiceUrl } from './mcpUrl'
import {
  createFenceSentinel,
  fenceToolSetResults,
  type FenceSentinel,
} from './toolOutputFencing'

type LecturerMcpClient = Awaited<ReturnType<typeof createSDKMCPClient>>

export type LecturerMcpToolBundle = {
  close: () => Promise<void>
  // Whether the minted MCP scope includes `manage:draft`, i.e. whether
  // `tools` still contains the draft/proposal tools. Callers use this to
  // keep the assistant's system prompt honest about what it can actually
  // call (see buildManageAssistantSystemPrompt).
  hasDraftScope: boolean
  // Per-request sentinel used to fence tool-result content in `tools`
  // (see toolOutputFencing.ts). Callers thread this into
  // buildManageAssistantSystemPrompt so the model is told what the fence
  // markers mean for this exact request.
  sentinel: FenceSentinel
  tools: ToolSet
}

// Tool names in apps/mcp-lecturer/src/toolPolicy.ts whose `rbacScope`
// includes 'manage:draft'. The MCP `tools/list` response only carries
// name/description/inputSchema/annotations (no rbacScope), so there is no
// protocol-level seam to derive this from the server at request time — this
// list is intentionally duplicated here. Keep it in sync with
// `LECTURER_MCP_TOOL_POLICIES` in apps/mcp-lecturer/src/toolPolicy.ts.
const DRAFT_SCOPED_TOOL_NAMES = new Set([
  'klicker_lecturer_question_draft',
  'klicker_lecturer_choices_draft',
  'klicker_lecturer_feedback_draft',
  'klicker_lecturer_element_create_draft_proposal',
])

export function filterToolsByDraftScope(
  tools: ToolSet,
  hasDraftScope: boolean
): ToolSet {
  if (hasDraftScope) return tools

  return Object.fromEntries(
    Object.entries(tools).filter(
      ([toolName]) => !DRAFT_SCOPED_TOOL_NAMES.has(toolName)
    )
  ) as ToolSet
}

export function getLecturerMcpUrl(
  env: NodeJS.ProcessEnv = process.env
): string | null {
  return buildMcpServiceUrl({
    defaultDevelopmentPort: '7081',
    env,
    names: {
      host: 'MCP_LECTURER_HOST',
      path: 'MCP_LECTURER_PATH',
      port: 'MCP_LECTURER_PORT',
      scheme: 'MCP_LECTURER_SCHEME',
      url: 'MCP_LECTURER_URL',
    },
  })
}

function combineAbortSignals(
  requestSignal: AbortSignal | undefined,
  transportSignal: AbortSignal | null | undefined
): AbortSignal | undefined {
  const signals = [requestSignal, transportSignal].filter(
    (candidate): candidate is AbortSignal =>
      candidate !== undefined && candidate !== null
  )

  if (signals.length === 0) return undefined
  if (signals.length === 1) return signals[0]
  return AbortSignal.any(signals)
}

export async function loadLecturerMcpTools(
  userId: string,
  sessionScope: string | undefined,
  // Injectable for deterministic tests; production callers rely on the
  // default fresh-per-request sentinel.
  toolOutputFenceSentinel: FenceSentinel = createFenceSentinel(),
  signal?: AbortSignal
): Promise<LecturerMcpToolBundle> {
  const url = getLecturerMcpUrl()
  if (!url) {
    return {
      close: async () => {},
      hasDraftScope: false,
      sentinel: toolOutputFenceSentinel,
      tools: {},
    }
  }

  const token = await mintLecturerMcpJwt(userId, sessionScope)
  const hasDraftScope = resolveLecturerMcpScope(sessionScope)
    .split(' ')
    .includes('manage:draft')
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
    // The MCP SDK supplies its own abort signal after spreading requestInit.
    // Compose it here so the route deadline and transport close both cancel
    // the actual fetch instead of one silently replacing the other.
    fetch: (input, init) =>
      fetch(input, {
        ...init,
        signal: combineAbortSignals(signal, init?.signal),
      }),
  })
  const client: LecturerMcpClient = await createSDKMCPClient({ transport })

  let closed = false
  const close = async () => {
    if (closed) return
    closed = true
    await client.close().catch((error: unknown) => {
      console.warn('Failed to close lecturer MCP client:', error)
    })
  }

  try {
    const tools = (await client.tools()) as ToolSet
    return {
      close,
      hasDraftScope,
      sentinel: toolOutputFenceSentinel,
      tools: fenceToolSetResults(
        filterToolsByDraftScope(tools, hasDraftScope),
        toolOutputFenceSentinel
      ),
    }
  } catch (error) {
    await close()
    throw error
  }
}
