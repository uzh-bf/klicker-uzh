import { experimental_createMCPClient as createSDKMCPClient } from '@ai-sdk/mcp'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { ToolSet } from 'ai'
import { mintLecturerMcpJwt } from '@/src/lib/server/mcpAuthMint'
import {
  classifyManageAssistantCapabilityState,
  type ManageAssistantCapabilityState,
} from './manageAssistantCapabilities'
import { buildMcpServiceUrl } from './mcpUrl'
import {
  createFenceSentinel,
  type FenceSentinel,
  fenceToolSetResults,
} from './toolOutputFencing'

type LecturerMcpClient = Awaited<ReturnType<typeof createSDKMCPClient>>

export type LecturerMcpToolBundle = {
  close: () => Promise<void>
  // Derived from the actual session-filtered inventory, not the scope that
  // requested it. Both preflight and chat turns use this value so a missing
  // proposal tool can never be described as available.
  capabilityState: ManageAssistantCapabilityState
  // Per-request sentinel used to fence tool-result content in `tools`
  // (see toolOutputFencing.ts). Callers thread this into
  // buildManageAssistantSystemPrompt so the model is told what the fence
  // markers mean for this exact request.
  sentinel: FenceSentinel
  tools: ToolSet
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
      capabilityState: 'unavailable',
      close: async () => {},
      sentinel: toolOutputFenceSentinel,
      tools: {},
    }
  }

  const token = await mintLecturerMcpJwt(userId, sessionScope)
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
      capabilityState: classifyManageAssistantCapabilityState(tools),
      close,
      sentinel: toolOutputFenceSentinel,
      tools: fenceToolSetResults(tools, toolOutputFenceSentinel),
    }
  } catch (error) {
    await close()
    throw error
  }
}
