import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { experimental_createMCPClient } from 'ai'

/**
 * Creates and initializes MCP client using StreamableHTTPClientTransport
 */
export async function createMCPClient(chatbotId: string) {
  const mcpKey = process.env.MCP_KEY
  const mcpUrl = process.env.MCP_URL

  if (!mcpUrl) {
    throw new Error('MCP_URL environment variable is not defined')
  }

  try {
    const httpTransport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
      requestInit: {
        headers: mcpKey
          ? {
              Authorization: `Bearer ${mcpKey}`,
              'Chatbot-ID': chatbotId,
              'Content-Type': 'application/json',
            }
          : {
              'Content-Type': 'application/json',
              'Chatbot-ID': chatbotId,
            },
      },
    })

    // create MCP client
    const client = await experimental_createMCPClient({
      transport: httpTransport,
    })
    console.log('✅ MCP Client initialized successfully')

    return client
  } catch (error) {
    console.error('❌ Failed to create MCP client:', error)
    throw error
  }
}

/**
 * Get tools from the MCP server
 */
export async function getMCPTools(chatbotId: string) {
  console.log('Loading MCP Tools...')

  try {
    const client = await createMCPClient(chatbotId)
    const tools = await client.tools()

    console.log('MCP Tools loaded successfully:', Object.keys(tools))
    return tools
  } catch (error) {
    console.error('Failed to load MCP Tools:', error)
    return {}
  }
}
