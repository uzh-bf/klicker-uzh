import { createServer } from 'node:http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import {
  createLocalAuthenticator,
  LOCAL_CHATBOT_ID,
} from './local-mcp-auth.mjs'
import {
  findLocalMcpDocuments,
  loadLocalMcpDocuments,
  toLocalMcpDocumentSource,
} from './local-mcp-documents.mjs'
import { loadLocalMcpFixture } from './local-mcp-fixture.mjs'

const HOST = '127.0.0.1'
const PORT = 1417
const MAX_BODY_BYTES = 1024 * 1024
const fixture = loadLocalMcpFixture(process.env)
const authenticate = await createLocalAuthenticator(process.env, fixture, {
  returnIdentity: true,
})

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
      'unsystematic risk',
      'spreading',
      'diversifikation',
      'diversifizieren',
      'diversifiziert',
      'streuung',
      'streuen',
      'idiosynkratisch',
      'unsystematisch',
      'korrelation',
    ],
    content:
      'Portfolio diversification spreads investments across assets, sectors, or regions. It can reduce idiosyncratic risk because a loss in one holding may be offset by gains in another. Diversification does not remove systematic market risk, and its benefit depends on the correlations between the holdings. Diversifikation (Risikostreuung) verteilt Anlagen über Titel, Branchen oder Regionen und senkt das idiosynkratische Risiko, weil Verluste eines Titels durch Gewinne eines anderen ausgeglichen werden können. Das systematische Marktrisiko bleibt bestehen, und der Nutzen hängt von den Korrelationen der Anlagen ab.',
    continuation:
      'Read diversification from the correlations, not from the number of holdings: two positions that move together add little risk reduction however many of them a portfolio holds.',
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
      'compounding',
      'zeitwert',
      'barwert',
      'endwert',
      'abzinsen',
      'abzinsung',
      'aufzinsen',
      'aufzinsung',
      'diskontieren',
      'diskontierung',
      'zins',
      'zahlungsstrom',
    ],
    content:
      'The time value of money means that a monetary amount available today is generally worth more than the same nominal amount available later. Present value discounts a future cash flow using an appropriate rate, while future value compounds a present amount over time. Der Zeitwert des Geldes bedeutet, dass ein heute verfügbarer Betrag in der Regel mehr wert ist als derselbe nominale Betrag zu einem späteren Zeitpunkt. Der Barwert diskontiert einen künftigen Zahlungsstrom mit einem passenden Zinssatz: PV = FV / (1 + r)^n, der Endwert zinst einen heutigen Betrag auf: FV = PV * (1 + r)^n; dabei ist r der Zinssatz pro Jahr als Dezimalzahl und n die Anzahl ganzer Jahre bis zur Zahlung, bei jährlicher Verzinsung.',
    continuation:
      'Discounting a stream of future cash flows is the same operation applied term by term; the present value of the stream is the sum of the individually discounted amounts.',
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
      'face value',
      'par value',
      'anleihe',
      'kupon',
      'rendite',
      'fälligkeit',
      'laufzeit',
      'nennwert',
      'festverzinslich',
    ],
    content:
      'A coupon bond is valued as the present value of its promised coupon payments and repayment of principal at maturity. Holding other factors constant, a rise in market yields lowers the price of an existing fixed-coupon bond, while a fall in yields raises its price. Eine Kuponanleihe wird als Barwert ihrer versprochenen Kuponzahlungen und der Rückzahlung des Nennwerts bei Fälligkeit bewertet: P = C / (1 + y)^1 + ... + C / (1 + y)^n + F / (1 + y)^n; dabei ist C die jährliche Kuponzahlung, F der Nennwert bei Fälligkeit, y die Marktrendite pro Jahr als Dezimalzahl und n die Anzahl ganzer Jahre bis zur Fälligkeit, bei jährlicher Verzinsung. Steigt die Marktrendite, fällt der Kurs einer bestehenden Anleihe mit festem Kupon; sinkt die Marktrendite, steigt der Kurs.',
    continuation:
      'The same valuation logic covers unequal coupons, and the yield to maturity is the single rate that makes the discounted promised cash flows equal the observed price.',
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
      'risk-free rate',
      'cost of equity',
      'eigenkapital',
      'prämie',
      'risikofrei',
      'systematisch',
    ],
    content:
      "The CAPM links an asset's required return to the risk-free rate plus beta multiplied by the market risk premium. Beta measures the asset's sensitivity to systematic market movements; diversifiable, idiosyncratic risk is not rewarded by the model. Das CAPM setzt die geforderte Rendite eines Vermögenswerts gleich dem risikofreien Zins plus Beta multipliziert mit der Marktrisikoprämie: r = r_f + beta * (r_m - r_f). Beta misst die Sensitivität gegenüber systematischen Marktbewegungen; diversifizierbares, idiosynkratisches Risiko wird nicht vergütet.",
    continuation:
      'Because only systematic risk is priced, an asset with high idiosyncratic volatility but a low beta can leave the required return almost unchanged.',
  },
]

const DOCUMENTS = loadLocalMcpDocuments(process.env, SYNTHETIC_DOCUMENTS)
const additionalDocuments = fixture
  ? loadLocalMcpDocuments(
      { LOCAL_MCP_DOCUMENTS_FILE: fixture.documentsFile },
      []
    )
  : null

function createMcpServer(documentsForIdentity) {
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
      const documents = findLocalMcpDocuments(documentsForIdentity, query)
      const payload = {
        answer:
          `KLICKER_LOCAL_MCP_OK: the local MCP server received "${query}". ` +
          `Retrieved ${documents.length} synthetic course-material excerpt(s).`,
        mode: 'documents',
        summary: { count: documents.length },
        sources_used: documents.length,
        sources: documents.map(toLocalMcpDocumentSource),
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

  const identity = await authenticate(request.headers)
  if (!identity) {
    sendJson(response, 401, { error: 'Unauthorized' })
    return
  }

  const mcpServer = createMcpServer(
    identity === LOCAL_CHATBOT_ID ? DOCUMENTS : additionalDocuments
  )
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
