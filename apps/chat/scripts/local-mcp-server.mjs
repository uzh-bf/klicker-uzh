import { createServer } from 'node:http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'

const HOST = '127.0.0.1'
const PORT = 1417
const MAX_BODY_BYTES = 1024 * 1024

function createMcpServer() {
  const server = new McpServer({
    name: 'klicker-local-test-mcp',
    version: '1.0.0',
  })

  server.registerTool(
    'doc_query',
    {
      title: 'Search synthetic course material',
      description:
        'Search deterministic synthetic course material. Use this tool whenever the user asks to test the local MCP integration.',
      inputSchema: {
        query: z
          .string()
          .min(1)
          .max(500)
          .describe('The synthetic course-material search query'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ query }) => {
      const payload = {
        answer: `KLICKER_LOCAL_MCP_OK: the local MCP server received "${query}".`,
        sources_used: 1,
        sources: [
          {
            expert: 'KlickerUZH local development fixture',
            source_type: 'pdf',
            file_name: 'synthetic-course-material.pdf',
            page_number: 1,
          },
        ],
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(payload) }],
        structuredContent: payload,
      }
    }
  )

  return server
}

async function readJsonBody(request) {
  const chunks = []
  let size = 0

  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) {
      throw new Error('Request body is too large')
    }
    chunks.push(chunk)
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body))
}

const httpServer = createServer(async (request, response) => {
  if (request.url === '/health' && request.method === 'GET') {
    sendJson(response, 200, { status: 'ok' })
    return
  }

  if (request.url !== '/mcp') {
    sendJson(response, 404, { error: 'Not found' })
    return
  }

  if (request.method !== 'POST') {
    response.writeHead(405, { Allow: 'POST' })
    response.end()
    return
  }

  const mcpServer = createMcpServer()
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    enableDnsRebindingProtection: true,
    allowedHosts: [`${HOST}:${PORT}`, `localhost:${PORT}`],
  })

  response.on('close', () => {
    void transport.close()
    void mcpServer.close()
  })

  try {
    const body = await readJsonBody(request)
    await mcpServer.connect(transport)
    await transport.handleRequest(request, response, body)
  } catch (error) {
    console.error('[local-mcp] Request failed:', error)
    if (!response.headersSent) {
      sendJson(response, 400, {
        jsonrpc: '2.0',
        error: { code: -32700, message: 'Invalid JSON-RPC request' },
        id: null,
      })
    }
  }
})

httpServer.listen(PORT, HOST, () => {
  console.log(`[local-mcp] Listening on http://${HOST}:${PORT}/mcp`)
})

function shutdown() {
  httpServer.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
