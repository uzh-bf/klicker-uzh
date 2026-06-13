// Local stub of the doc_query MCP server. The real KB backend (localhost:1417 /
// mcp.klicker.com) is not running in this dev environment, so we stand up a
// Streamable-HTTP MCP server that mirrors the real contract:
//   - tool name `doc_query` with input `{ query, top_k? }`
//   - served at `/mcp`
//   - logs the `Chatbot-ID` / `Authorization` headers it receives, so S1 can
//     PROVE our DB-driven auth/header rebind reaches the server.
// This is the validation target for the MCP rebind seam, not the real RAG.
import http from 'node:http'
import { MCPServer } from '@mastra/mcp'
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

// Tiny canned course knowledge base (algorithms). Keyword-scored.
const KB: { id: string; title: string; text: string }[] = [
  {
    id: 'kb-dijkstra',
    title: "Dijkstra's algorithm",
    text: "Dijkstra's algorithm computes single-source shortest paths in a graph with non-negative edge weights. It maintains a priority queue of tentative distances and repeatedly extracts the closest unsettled vertex, relaxing its outgoing edges. Course note: the exam emphasises the relaxation invariant and why negative edges break it.",
  },
  {
    id: 'kb-quicksort',
    title: 'Quicksort worst case',
    text: 'Quicksort runs in O(n log n) on average but degrades to O(n^2) when the pivot is consistently the smallest or largest element, e.g. an already-sorted array with a naive first-element pivot. Randomised or median-of-three pivots make the worst case improbable.',
  },
  {
    id: 'kb-hashing',
    title: 'Hash tables and load factor',
    text: 'A hash table stores key/value pairs in buckets indexed by a hash of the key. The load factor (entries / buckets) controls performance: above ~0.7 collisions rise and the table is resized. Course note: students must be able to compare chaining vs open addressing.',
  },
]

const docQuery = createTool({
  id: 'doc_query',
  description:
    'Search the course knowledge base for passages relevant to a query. Returns ranked passages with title and text.',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
    top_k: z.number().optional().describe('How many passages to return (default 2)'),
  }),
  execute: async (input: { query: string; top_k?: number }) => {
    const terms = input.query.toLowerCase().split(/\W+/).filter(Boolean)
    const scored = KB.map((doc) => {
      const hay = `${doc.title} ${doc.text}`.toLowerCase()
      const score = terms.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0)
      return { doc, score }
    })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, input.top_k ?? 2)
    return {
      passages: scored.map((r) => ({ id: r.doc.id, title: r.doc.title, text: r.doc.text })),
    }
  },
})

const server = new MCPServer({
  name: 'KB',
  version: '0.0.1',
  tools: { doc_query: docQuery },
})

const PORT = Number(process.env.PROTO_MCP_PORT ?? 7110)
const httpServer = http.createServer(async (req, res) => {
  // Auth-proof log: this is how S1 confirms the rebind delivered our headers.
  console.log(
    `[stub-mcp] ${req.method} ${req.url} chatbot-id=${req.headers['chatbot-id'] ?? '-'} auth=${req.headers['authorization'] ? 'present' : '-'}`
  )
  try {
    await server.startHTTP({
      url: new URL(req.url ?? '/', `http://localhost:${PORT}`),
      httpPath: '/mcp',
      req,
      res,
    })
  } catch (err) {
    console.error('[stub-mcp] error', err)
    if (!res.headersSent) {
      res.writeHead(500).end('stub-mcp error')
    }
  }
})

httpServer.listen(PORT, () => {
  console.log(`[stub-mcp] doc_query MCP listening on http://localhost:${PORT}/mcp`)
})
