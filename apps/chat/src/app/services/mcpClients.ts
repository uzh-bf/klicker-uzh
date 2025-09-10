import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { experimental_createMCPClient } from 'ai'

/**
 * Creates and initializes Context7 MCP client using StreamableHTTPClientTransport
 */
export async function createContext7MCPClient() {
  const apiKey = process.env.CONTEXT7_API_KEY
  const port = process.env.CONTEXT7_PORT || '9000'

  console.log(
    'Creating Context7 MCP client with StreamableHTTPClientTransport...'
  )

  try {
    const httpTransport = new StreamableHTTPClientTransport(
      new URL(`http://localhost:${port}/mcp`),
      {
        requestInit: {
          headers: apiKey
            ? {
                Authorization: `Bearer ${apiKey}`,
                'Chatbot-ID': 'TODO',
                'Content-Type': 'application/json',
              }
            : {
                'Content-Type': 'application/json',
              },
        },
      }
    )

    // create MCP client
    const client = await experimental_createMCPClient({
      transport: httpTransport,
    })
    console.log('✅ Context7 MCP Client initialized successfully')

    return client
  } catch (error) {
    console.error('❌ Failed to create Context7 MCP client:', error)
    throw error
  }
}

/**
 * Get Context7 tools from the MCP server
 */
export async function getContext7Tools() {
  console.log('Loading Context7 MCP Tools...')

  try {
    const client = await createContext7MCPClient()
    const tools = await client.tools()

    console.log('Context7 MCP Tools loaded successfully:', Object.keys(tools))
    return tools
  } catch (error) {
    console.error('Failed to load Context7 MCP Tools:', error)
    return {}
  }
}
