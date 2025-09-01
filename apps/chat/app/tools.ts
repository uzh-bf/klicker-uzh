import { tool } from 'ai'
import { z } from 'zod'

export const getWeather = tool({
  description: 'Get weather for a location',
  inputSchema: z.object({
    location: z.string().describe('The location to get weather for'),
  }),
  execute: async ({ location }) => {
    const response = await fetch('http://localhost:8000/api/tools/weather', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location }),
    })
    console.log('Wheather API response:', response)
    return await response.json()
  },
})

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

export const context7 = tool({
  description:
    'Fetch up-to-date documentation or code examples from Context7 for libraries.',
  inputSchema: z.object({
    libraryName: z
      .string()
      .optional()
      .describe(
        'The name of the library to search for (e.g., "react", "next.js", "leaflet")'
      ),
    context7CompatibleLibraryID: z
      .string()
      .optional()
      .describe(
        'Exact Context7-compatible library ID (e.g., "/vercel/next.js", "/leaflet/documentation")'
      ),
    topic: z
      .string()
      .optional()
      .describe(
        'Specific topic to focus on (e.g., "ssr", "routing", "mapping")'
      ),
    tokens: z
      .number()
      .optional()
      .default(5000)
      .describe('Max number of tokens to return (default: 5000)'),
    type: z
      .enum(['txt', 'json'])
      .optional()
      .default('txt')
      .describe('Response format (txt or json)'),
  }),
  execute: async ({
    libraryName,
    context7CompatibleLibraryID,
    topic,
    tokens,
    type,
  }) => {
    const apiKey = process.env.CONTEXT7_API_KEY
    if (!apiKey) {
      throw new Error('CONTEXT7_API_KEY environment variable is required')
    }

    try {
      // fetch documentation directly
      if (context7CompatibleLibraryID) {
        const url = new URL(
          `https://context7.com/api/v1${context7CompatibleLibraryID}`
        )

        // add query parameters
        if (type) url.searchParams.set('type', type)
        if (topic) url.searchParams.set('topic', topic)
        if (tokens) url.searchParams.set('tokens', tokens.toString())

        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        })

        if (!response.ok) {
          throw new Error(
            `Context7 API error: ${response.status} ${response.statusText}`
          )
        }

        const result = await response.text()
        return {
          libraryId: context7CompatibleLibraryID,
          topic,
          content: result,
        }
      }

      if (libraryName) {
        const searchUrl = `https://context7.com/api/v1/search?query=${encodeURIComponent(libraryName)}`
        const searchResponse = await fetch(searchUrl, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        })

        if (!searchResponse.ok) {
          throw new Error(
            `Context7 search API error: ${searchResponse.status} ${searchResponse.statusText}`
          )
        }

        const searchResult = await searchResponse.json()

        if (!searchResult.results || searchResult.results.length === 0) {
          return {
            error: `No libraries found for: ${libraryName}`,
            searchResults: [],
          }
        }

        // use first (most relevant) result
        const firstResult = searchResult.results[0]
        const libraryId = firstResult.id

        const docUrl = new URL(`https://context7.com/api/v1${libraryId}`)

        if (type) docUrl.searchParams.set('type', type)
        if (topic) docUrl.searchParams.set('topic', topic)
        if (tokens) docUrl.searchParams.set('tokens', tokens.toString())

        const docResponse = await fetch(docUrl.toString(), {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        })

        if (!docResponse.ok) {
          throw new Error(
            `Context7 documentation API error: ${docResponse.status} ${docResponse.statusText}`
          )
        }

        const documentation = await docResponse.text()

        return {
          libraryName: firstResult.title,
          libraryId: libraryId,
          description: firstResult.description,
          trustScore: firstResult.trustScore,
          stars: firstResult.stars,
          topic,
          content: documentation,
          searchResults: searchResult.results.slice(0, 3),
        }
      }

      throw new Error(
        'Either libraryName or context7CompatibleLibraryID must be provided'
      )
    } catch (error) {
      console.error('Error executing Context7 tool:', error)
      throw error
    }
  },
})
