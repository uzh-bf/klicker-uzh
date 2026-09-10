import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import { startCourseImageDemoModel } from './local-course-image-model.mjs'
import { createLocalAuthenticator } from './local-mcp-auth.mjs'

if (process.env.LOCAL_COURSE_IMAGE_DEMO === '1') startCourseImageDemoModel()

const HOST = '127.0.0.1'
const PORT = 1417
const MAX_BODY_BYTES = 1024 * 1024
const authenticate = await createLocalAuthenticator(process.env)

const SYNTHETIC_DOCUMENTS = [
  {
    title: 'Portfolio diversification',
    page: 1,
    keywords: [
      'portfolio',
      'diversification',
      'diversify',
      'idiosyncratic',
      'correlation',
      'asset allocation',
      'course',
      'exam',
      'practice',
    ],
    content:
      'Portfolio diversification spreads investments across assets, sectors, or regions. It can reduce idiosyncratic risk because a loss in one holding may be offset by gains in another. Diversification does not remove systematic market risk, and its benefit depends on the correlations between the holdings.',
  },
  {
    title: 'Time value of money',
    page: 2,
    keywords: [
      'time value',
      'present value',
      'future value',
      'discount',
      'interest rate',
      'cash flow',
      'course',
      'exam',
      'practice',
    ],
    content:
      'The time value of money means that a monetary amount available today is generally worth more than the same nominal amount available later. Present value discounts a future cash flow using an appropriate rate, while future value compounds a present amount over time.',
  },
  {
    title: 'Bond pricing',
    page: 3,
    keywords: [
      'bond',
      'fixed income',
      'coupon',
      'yield',
      'maturity',
      'interest rate',
      'course',
      'exam',
      'practice',
    ],
    content:
      'A coupon bond is valued as the present value of its promised coupon payments and repayment of principal at maturity. Holding other factors constant, a rise in market yields lowers the price of an existing fixed-coupon bond, while a fall in yields raises its price.',
  },
  {
    title: 'CAPM and required return',
    page: 4,
    keywords: [
      'capm',
      'beta',
      'required return',
      'market risk premium',
      'systematic risk',
      'expected return',
      'course',
      'exam',
      'practice',
    ],
    content:
      "The CAPM links an asset's required return to the risk-free rate plus beta multiplied by the market risk premium. Beta measures the asset's sensitivity to systematic market movements; diversifiable, idiosyncratic risk is not rewarded by the model.",
  },
]

function findDocuments(query) {
  const normalizedQuery = query.toLowerCase()
  return SYNTHETIC_DOCUMENTS.filter((document) =>
    document.keywords.some((keyword) => normalizedQuery.includes(keyword))
  )
}

function createMcpServer() {
  const server = new McpServer({
    name: 'klicker-local-test-mcp',
    version: '1.0.0',
  })

  server.registerTool(
    'doc_query',
    {
      title: 'Search local course material',
      description:
        'Search the local course material for passages and original figure references. The optional private corpus includes BFI Skript; the synthetic learning-cycle document is also available.',
      inputSchema: {
        query: z
          .string()
          .min(1)
          .max(500)
          .describe(
            'The course-material search query; include the document title and physical page when known'
          ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ query }) => {
      if (
        /learning.?cycle|lernzyklus/i.test(query) &&
        process.env.CHAT_COURSE_IMAGE_STORE_PATH
      ) {
        const payload = JSON.parse(
          await readFile(
            new URL(
              './fixtures/course-images/query-result.json',
              import.meta.url
            ),
            'utf8'
          )
        )
        return {
          content: [{ type: 'text', text: JSON.stringify(payload) }],
          structuredContent: payload,
        }
      }
      // Optional local component demo. Keep private corpus data out of fixtures.
      if (process.env.LOCAL_COURSE_QUERY_URL) {
        const endpoint = new URL(process.env.LOCAL_COURSE_QUERY_URL)
        if (
          endpoint.protocol !== 'http:' ||
          !['127.0.0.1', 'localhost', 'host.docker.internal'].includes(
            endpoint.hostname
          )
        ) {
          throw new Error('Course component endpoint must be local')
        }
        const response = await fetch(endpoint, {
          method: 'POST',
          redirect: 'error',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
          signal: AbortSignal.timeout(15000),
        })
        if (!response.ok) throw new Error('Local course search unavailable')
        const payload = await response.json()
        return {
          content: [{ type: 'text', text: JSON.stringify(payload) }],
          structuredContent: payload,
        }
      }
      const documents = findDocuments(query)
      const payload = {
        answer:
          `KLICKER_LOCAL_MCP_OK: the local MCP server received "${query}". ` +
          `Retrieved ${documents.length} synthetic course-material excerpt(s).`,
        mode: 'documents',
        summary: { count: documents.length },
        sources_used: documents.length,
        sources: documents.map((document) => ({
          reference: 'synthetic-course-material.pdf',
          reference_type: 'pdf',
          source_type: 'document',
          title: document.title,
          chunks: [
            {
              content: document.content,
              page_number: document.page,
            },
          ],
        })),
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
    sendJson(response, 200, {
      status: 'ok',
      generation: process.env.LOCAL_MCP_GENERATION,
    })
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

  if (!(await authenticate(request.headers))) {
    sendJson(response, 401, { error: 'Unauthorized' })
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
  } catch {
    console.error('[local-mcp] Invalid request')
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
