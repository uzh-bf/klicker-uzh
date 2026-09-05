import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { encrypt } from '@klicker-uzh/util'
import { CHATBOT_ID_TEST } from './seedChatbots.js'

enum MCP_SERVER_NAMES {
  Context7 = 'Context7',
  KB = 'KB',
}

interface MCPServerSeed {
  name: MCP_SERVER_NAMES
  description: string
  url: string
  authType: 'bearer' | 'basic' | 'none' | 'custom' | 'scope_token'
  authSecret?: string
  parameters?: any
  isActive?: boolean
  passChatbotId?: boolean
  chatbotIdHeader?: string
}

// Define common MCP servers to seed
const MCP_SERVERS: MCPServerSeed[] = [
  {
    name: MCP_SERVER_NAMES.Context7,
    description: 'Up-to-date documentation for LLMs and AI code editors',
    url: 'https://mcp.context7.com/mcp',
    authType: 'bearer',
    authSecret: process.env.MCP_CONTEXT7_API_KEY,
    isActive: true,
    passChatbotId: false,
  },
  {
    name: MCP_SERVER_NAMES.KB,
    description: 'A comprehensive knowledge base for various topics',
    url: 'http://localhost:1417/mcp',
    authType: 'scope_token',
    isActive: true,
    passChatbotId: false,
  },
]

interface ChatbotMCPConfigSeed {
  chatbotId: string
  mcpServerName: MCP_SERVER_NAMES
  chatMode: string
  allowedTools: string[]
  priority: number
  isEnabled: boolean
  parameters?: any
}

// Example configurations for different chat modes
const EXAMPLE_CONFIGURATIONS: ChatbotMCPConfigSeed[] = [
  {
    chatbotId: CHATBOT_ID_TEST,
    mcpServerName: MCP_SERVER_NAMES.KB,
    chatMode: 'tutor',
    allowedTools: ['doc_query'],
    priority: 0,
    isEnabled: false,
  },
  {
    chatbotId: CHATBOT_ID_TEST,
    mcpServerName: MCP_SERVER_NAMES.KB,
    chatMode: 'explainer',
    allowedTools: ['doc_query'],
    priority: 0,
    isEnabled: false,
  },
  {
    chatbotId: CHATBOT_ID_TEST,
    mcpServerName: MCP_SERVER_NAMES.Context7,
    chatMode: 'tutor',
    allowedTools: ['resolve-library-id', 'get-library-docs'],
    priority: 10,
    isEnabled: true,
  },
]

/**
 * Validates and encrypts a secret based on auth type
 */
function encryptSecret(
  secret?: string,
  authType?: string,
  serverName?: string
): string | undefined {
  if (!secret || secret.trim() === '') {
    return undefined
  }

  try {
    // Validate custom auth JSON format
    if (authType === 'custom') {
      let parsedSecret: any

      // Check if it's already a JSON object (from environment)
      if (typeof secret === 'string' && secret.startsWith('{')) {
        parsedSecret = JSON.parse(secret)
      } else {
        // Assume it's a plain API key, wrap it in default format
        parsedSecret = {
          headers: {
            Authorization: `Bearer ${secret}`,
          },
        }
        secret = JSON.stringify(parsedSecret)
      }

      // Validate structure
      if (!parsedSecret.headers || typeof parsedSecret.headers !== 'object') {
        console.error(
          `Invalid custom auth format for ${serverName}: missing 'headers' object`
        )
        return undefined
      }

      console.log(
        `Validated custom headers for ${serverName}: ${Object.keys(parsedSecret.headers).join(', ')}`
      )
    }

    return encrypt(secret)
  } catch (error) {
    console.error(`Failed to encrypt secret for ${serverName}: ${error}`)
    return undefined
  }
}

/**
 * Validates MCP server configuration before creation
 */
function validateServerConfig(serverConfig: MCPServerSeed): boolean {
  if (!serverConfig.name || !serverConfig.description) {
    console.error(`Server missing required fields: name or description`)
    return false
  }

  if (!serverConfig.url) {
    console.log(`Server '${serverConfig.name}' has no URL - will be skipped`)
    return false
  }

  // Validate URL format
  try {
    new URL(serverConfig.url)
  } catch (error) {
    console.error(`Invalid URL for ${serverConfig.name}: ${serverConfig.url}`)
    return false
  }

  // Validate auth type
  const validAuthTypes = ['bearer', 'basic', 'none', 'custom', 'scope_token']
  if (!validAuthTypes.includes(serverConfig.authType)) {
    console.error(
      `Invalid auth type for ${serverConfig.name}: ${serverConfig.authType}`
    )
    return false
  }

  // Validate custom header name if provided
  if (
    serverConfig.chatbotIdHeader &&
    !/^[a-zA-Z][a-zA-Z0-9-_]*$/.test(serverConfig.chatbotIdHeader)
  ) {
    console.error(
      `Invalid chatbot ID header name for ${serverConfig.name}: ${serverConfig.chatbotIdHeader}`
    )
    return false
  }

  return true
}

/**
 * Seeds MCP server configurations
 */
export async function seedMCPServers(prisma: PrismaClient) {
  console.log('Seeding MCP servers...')

  const createdServers = []

  for (const serverConfig of MCP_SERVERS) {
    try {
      // Validate server configuration first
      if (!validateServerConfig(serverConfig)) {
        console.log(`Skipping '${serverConfig.name}' due to validation errors`)
        continue
      }

      // Check if server already exists
      const existingServer = await prisma.chatbotMCPServer.findUnique({
        where: { name: serverConfig.name },
      })

      if (existingServer) {
        if (serverConfig.name === MCP_SERVER_NAMES.KB) {
          const reconciledServer = await prisma.chatbotMCPServer.update({
            where: { id: existingServer.id },
            data: {
              description: serverConfig.description,
              url: serverConfig.url,
              authType: serverConfig.authType,
              authSecret: null,
              parameters: serverConfig.parameters || {},
              isActive: serverConfig.isActive ?? true,
              passChatbotId: false,
              chatbotIdHeader: null,
            },
          })
          console.log(
            `Reconciled MCP server '${serverConfig.name}' with scoped authentication`
          )
          createdServers.push(reconciledServer)
          continue
        }

        console.log(
          `MCP server '${serverConfig.name}' already exists, skipping`
        )
        createdServers.push(existingServer)
        continue
      }

      // Encrypt the auth secret with enhanced validation
      const encryptedSecret = encryptSecret(
        serverConfig.authSecret,
        serverConfig.authType,
        serverConfig.name
      )

      if (serverConfig.authSecret && !encryptedSecret) {
        console.log(
          `Skipping '${serverConfig.name}' - secret encryption failed`
        )
        continue
      }

      const server = await prisma.chatbotMCPServer.create({
        data: {
          name: serverConfig.name,
          description: serverConfig.description,
          url: serverConfig.url,
          authType: serverConfig.authType,
          authSecret: encryptedSecret,
          parameters: serverConfig.parameters || {},
          isActive: serverConfig.isActive ?? true,
          passChatbotId: serverConfig.passChatbotId ?? false,
          chatbotIdHeader: serverConfig.chatbotIdHeader,
        },
      })

      console.log(`Created MCP server: ${server.name}`)
      createdServers.push(server)
    } catch (error) {
      console.error(
        `Failed to create MCP server '${serverConfig.name}':`,
        error
      )
    }
  }

  return createdServers
}

/**
 * Seeds example chatbot MCP configurations
 */
type SeededMCPServers = Awaited<ReturnType<typeof seedMCPServers>>

export async function seedChatbotMCPConfigurations(
  prisma: PrismaClient,
  servers: SeededMCPServers
) {
  console.log('Seeding example chatbot configurations...')

  const configurations = EXAMPLE_CONFIGURATIONS.map((config) => ({
    ...config,
    chatbotId: CHATBOT_ID_TEST,
  }))

  for (const config of configurations) {
    try {
      const mcpServer = servers.find((s) => s.name === config.mcpServerName)
      if (!mcpServer) {
        console.log(
          `MCP server '${config.mcpServerName}' not found, skipping configuration`
        )
        continue
      }

      const enabledBinding =
        config.mcpServerName === MCP_SERVER_NAMES.KB
          ? await prisma.kBChatbot.findFirst({
              where: { chatbotId: config.chatbotId, isEnabled: true },
              select: { id: true },
            })
          : null

      const existingConfig = await prisma.chatbotMCPConfig.findUnique({
        where: {
          chatbotId_mcpServerId_chatMode: {
            chatbotId: config.chatbotId,
            mcpServerId: mcpServer.id,
            chatMode: config.chatMode,
          },
        },
      })

      if (existingConfig) {
        if (config.mcpServerName === MCP_SERVER_NAMES.KB) {
          await prisma.chatbotMCPConfig.update({
            where: { id: existingConfig.id },
            data: {
              allowedTools: ['doc_query'],
              priority: 0,
              isEnabled: Boolean(enabledBinding),
            },
          })
          console.log(
            `Reconciled ${config.mcpServerName}/${config.chatMode} from its KB binding`
          )
          continue
        }

        console.log(
          `Configuration for ${config.mcpServerName}/${config.chatMode} already exists, skipping`
        )
        continue
      }

      await prisma.chatbotMCPConfig.create({
        data: {
          chatbotId: config.chatbotId,
          mcpServerId: mcpServer.id,
          chatMode: config.chatMode,
          allowedTools: config.allowedTools,
          priority: config.priority,
          isEnabled:
            config.mcpServerName === MCP_SERVER_NAMES.KB
              ? Boolean(enabledBinding)
              : config.isEnabled,
          parameters: config.parameters || {},
        },
      })

      console.log(
        `Created configuration: ${config.mcpServerName}/${config.chatMode}`
      )
    } catch (error) {
      console.error(
        `Failed to create configuration for ${config.mcpServerName}/${config.chatMode}:`,
        error
      )
    }
  }
}
