import type { Prisma, PrismaClient } from '@klicker-uzh/prisma/client'
import type {
  CohortActivationConfigCreate,
  CohortActivationConfigRecord,
  CohortActivationConfigUpdate,
  CohortActivationServerCreate,
  CohortActivationServerRecord,
  CohortActivationStore,
  CohortActivationTransactionStore,
  JsonValue,
} from './doc-query-cohort-activation.js'

type PrismaCohortActivationClient = Pick<
  PrismaClient,
  'chatbotMCPServer' | 'chatbotMCPConfig'
>

const serverSelect = {
  id: true,
  name: true,
  description: true,
  url: true,
  authType: true,
  passChatbotId: true,
  chatbotIdHeader: true,
  parameters: true,
  isActive: true,
  updatedAt: true,
} as const

const configSelect = {
  id: true,
  chatbotId: true,
  mcpServerId: true,
  chatMode: true,
  allowedTools: true,
  priority: true,
  isEnabled: true,
  parameters: true,
  updatedAt: true,
} as const

const SERIALIZABLE_TRANSACTION_RETRY_LIMIT = 3

function isSerializationConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2034'
  )
}

function mapServer(
  record: {
    id: string
    name: string
    description: string | null
    url: string
    authType: string
    passChatbotId: boolean
    chatbotIdHeader: string | null
    parameters: unknown
    isActive: boolean
    updatedAt: Date
  },
  hasAuthSecret: boolean
): CohortActivationServerRecord {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    url: record.url,
    authType: record.authType,
    passChatbotId: record.passChatbotId,
    chatbotIdHeader: record.chatbotIdHeader,
    hasAuthSecret,
    parameters: record.parameters as JsonValue,
    isActive: record.isActive,
    updatedAt: record.updatedAt,
  }
}

async function hasAuthSecret(
  client: PrismaCohortActivationClient,
  id: string
): Promise<boolean> {
  const count = await client.chatbotMCPServer.count({
    where: { id, authSecret: { not: null } },
  })
  return count === 1
}

function mapConfig(record: {
  id: string
  chatbotId: string
  mcpServerId: string
  chatMode: string
  allowedTools: unknown
  priority: number
  isEnabled: boolean
  parameters: unknown
  updatedAt: Date
}): CohortActivationConfigRecord {
  return {
    ...record,
    allowedTools: record.allowedTools as JsonValue,
    parameters: record.parameters as JsonValue,
  }
}

function createTransactionStore(
  client: PrismaCohortActivationClient
): CohortActivationTransactionStore {
  return {
    async findServerByName(name) {
      const record = await client.chatbotMCPServer.findUnique({
        where: { name },
        select: serverSelect,
      })
      return record
        ? mapServer(record, await hasAuthSecret(client, record.id))
        : null
    },
    async findServerById(id) {
      const record = await client.chatbotMCPServer.findUnique({
        where: { id },
        select: serverSelect,
      })
      return record
        ? mapServer(record, await hasAuthSecret(client, record.id))
        : null
    },
    async findConfigById(id) {
      const record = await client.chatbotMCPConfig.findUnique({
        where: { id },
        select: configSelect,
      })
      return record ? mapConfig(record) : null
    },
    async findConfigByChatbotServer(chatbotId, mcpServerId, chatMode) {
      const record = await client.chatbotMCPConfig.findUnique({
        where: {
          chatbotId_mcpServerId_chatMode: {
            chatbotId,
            mcpServerId,
            chatMode,
          },
        },
        select: configSelect,
      })
      return record ? mapConfig(record) : null
    },
    async findConfigsByServerId(mcpServerId) {
      const records = await client.chatbotMCPConfig.findMany({
        where: { mcpServerId },
        select: configSelect,
      })
      return records.map(mapConfig)
    },
    async createServer(data: CohortActivationServerCreate) {
      const record = await client.chatbotMCPServer.create({
        data: {
          ...(data.id ? { id: data.id } : {}),
          name: data.name,
          description: data.description,
          url: data.url,
          authType: data.authType,
          authSecret: data.encryptedBearer,
          passChatbotId: data.passChatbotId,
          chatbotIdHeader: data.chatbotIdHeader,
          parameters: data.parameters as Prisma.InputJsonValue,
          isActive: data.isActive,
        },
        select: serverSelect,
      })
      return mapServer(record, await hasAuthSecret(client, record.id))
    },
    async createConfig(data: CohortActivationConfigCreate) {
      const record = await client.chatbotMCPConfig.create({
        data: {
          ...(data.id ? { id: data.id } : {}),
          chatbotId: data.chatbotId,
          mcpServerId: data.mcpServerId,
          chatMode: data.chatMode,
          allowedTools: data.allowedTools as Prisma.InputJsonValue,
          priority: data.priority,
          isEnabled: data.isEnabled,
          parameters: data.parameters as Prisma.InputJsonValue,
        },
        select: configSelect,
      })
      return mapConfig(record)
    },
    async updateConfig(
      id,
      expectedUpdatedAt,
      data: CohortActivationConfigUpdate
    ) {
      const result = await client.chatbotMCPConfig.updateMany({
        where: { id, updatedAt: expectedUpdatedAt },
        data: {
          chatbotId: data.chatbotId,
          mcpServerId: data.mcpServerId,
          chatMode: data.chatMode,
          allowedTools: data.allowedTools as Prisma.InputJsonValue,
          priority: data.priority,
          isEnabled: data.isEnabled,
          parameters: data.parameters as Prisma.InputJsonValue,
        },
      })
      if (result.count !== 1) return null
      const record = await client.chatbotMCPConfig.findUnique({
        where: { id },
        select: configSelect,
      })
      return record ? mapConfig(record) : null
    },
  }
}

export function createPrismaCohortActivationStore(
  client: PrismaClient
): CohortActivationStore {
  return {
    async transaction(callback) {
      for (
        let attempt = 0;
        attempt < SERIALIZABLE_TRANSACTION_RETRY_LIMIT;
        attempt += 1
      ) {
        try {
          return await client.$transaction(
            (tx) => callback(createTransactionStore(tx)),
            {
              isolationLevel: 'Serializable',
              timeout: 120_000,
            }
          )
        } catch (error) {
          if (
            !isSerializationConflict(error) ||
            attempt === SERIALIZABLE_TRANSACTION_RETRY_LIMIT - 1
          ) {
            throw error
          }
        }
      }

      throw new Error('Serializable transaction retry limit exceeded')
    },
  }
}
