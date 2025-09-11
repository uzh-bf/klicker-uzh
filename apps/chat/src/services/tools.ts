import { tool } from 'ai'
import { z } from 'zod'

export const RAGSearch = tool({
  description:
    'Ask questions about lecture slides and course materials. This tool uses RAG to provide comprehensive answers based on lecture content.',
  inputSchema: z.object({
    query: z.string().describe('The question to ask about the lecture content'),
    top_k: z
      .number()
      .optional()
      .default(3)
      .describe('Number of relevant slides to use for context (max: 5)'),
  }),
  execute: async ({ query, top_k }) => {
    const response = await fetch(
      'http://localhost:8000/api/tools/search_lecture_slides',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, top_k }),
      }
    )
    const result = await response.json()
    return result
  },
})
