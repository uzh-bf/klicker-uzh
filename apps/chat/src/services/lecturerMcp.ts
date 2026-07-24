import { mintLecturerMcpJwt } from '@/src/lib/server/mcpAuthMint'
import { experimental_createMCPClient as createSDKMCPClient } from '@ai-sdk/mcp'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { ToolSet } from 'ai'
import { buildMcpServiceUrl } from './mcpUrl'

type LecturerMcpClient = Awaited<ReturnType<typeof createSDKMCPClient>>

export type LecturerMcpToolBundle = {
  close: () => Promise<void>
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

export async function loadLecturerMcpTools(
  userId: string
): Promise<LecturerMcpToolBundle> {
  const url = getLecturerMcpUrl()
  if (!url) {
    return {
      close: async () => {},
      tools: {},
    }
  }

  const token = await mintLecturerMcpJwt(userId)
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
    return {
      close,
      tools: (await client.tools()) as ToolSet,
    }
  } catch (error) {
    await close()
    throw error
  }
}
