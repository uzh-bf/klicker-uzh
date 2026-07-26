import {
  mintLecturerMcpJwt,
  resolveLecturerMcpScope,
} from '@/src/lib/server/mcpAuthMint'
import { experimental_createMCPClient as createSDKMCPClient } from '@ai-sdk/mcp'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { ToolSet } from 'ai'
import { buildMcpServiceUrl } from './mcpUrl'

type LecturerMcpClient = Awaited<ReturnType<typeof createSDKMCPClient>>

export type LecturerMcpToolBundle = {
  close: () => Promise<void>
  // Whether the minted MCP scope includes `manage:draft`, i.e. whether
  // `tools` still contains the draft/proposal tools. Callers use this to
  // keep the assistant's system prompt honest about what it can actually
  // call (see buildManageAssistantSystemPrompt).
  hasDraftScope: boolean
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

export async function loadLecturerMcpTools(
  userId: string,
  sessionScope: string | undefined
): Promise<LecturerMcpToolBundle> {
  const url = getLecturerMcpUrl()
  if (!url) {
    return {
      close: async () => {},
      hasDraftScope: false,
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
      tools: filterToolsByDraftScope(tools, hasDraftScope),
    }
  } catch (error) {
    await close()
    throw error
  }
}
