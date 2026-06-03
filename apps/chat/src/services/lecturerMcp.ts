import { experimental_createMCPClient as createSDKMCPClient } from '@ai-sdk/mcp'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { ToolSet } from 'ai'
import { mintLecturerMcpJwt } from '../lib/server/mcpAuthMint'

type LecturerMcpClient = Awaited<ReturnType<typeof createSDKMCPClient>>

export type LecturerMcpToolBundle = {
  close: () => Promise<void>
  tools: ToolSet
}

function normalizedPath(value: string | undefined): string {
  if (!value) return '/mcp'
  return value.startsWith('/') ? value : `/${value}`
}

export function getLecturerMcpUrl(
  env: NodeJS.ProcessEnv = process.env
): string | null {
  if (env.MCP_LECTURER_URL) {
    return env.MCP_LECTURER_URL
  }

  if (env.MCP_LECTURER_HOST) {
    const scheme = env.MCP_LECTURER_SCHEME ?? 'http'
    const port = env.MCP_LECTURER_PORT ? `:${env.MCP_LECTURER_PORT}` : ''
    return `${scheme}://${env.MCP_LECTURER_HOST}${port}${normalizedPath(
      env.MCP_LECTURER_PATH
    )}`
  }

  if (env.NODE_ENV === 'development') {
    return `http://localhost:${env.MCP_LECTURER_PORT ?? '7081'}${normalizedPath(
      env.MCP_LECTURER_PATH
    )}`
  }

  return null
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
