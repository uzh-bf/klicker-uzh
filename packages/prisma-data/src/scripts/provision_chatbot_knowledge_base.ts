/**
 * Adopt or create the knowledge base of an existing course chatbot, bind it,
 * and project the Doc Query scope from that binding.
 *
 * This is the operational script for chatbots whose Doc Query scope was served
 * from a hard-coded, unregistered knowledge-base id: it turns that id into a
 * real knowledge base (with the passed id, so already-served rows stay in
 * scope), binds it to the chatbot, repairs the Doc Query configuration
 * parameters so they match the binding, and retires a named legacy Doc Query
 * server for this chatbot once nothing enabled depends on it.
 *
 * Dry run is the default; every write requires `--apply` plus
 * `--snapshot-out`, which records the pre-apply state that `--rollback`
 * restores. See lib/chatbotKnowledgeBaseScope.ts for the projection rules.
 *
 * Usage:
 *   tsx provision_chatbot_knowledge_base.ts \
 *     --chatbot-id <uuid> --kb-id <uuid> --kb-name <text> --owner <email> \
 *     [--description <text>] [--legacy-server <name>] \
 *     [--snapshot-out <path>] [--apply]
 *   tsx provision_chatbot_knowledge_base.ts --rollback --snapshot <path>
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { prisma } from '@klicker-uzh/prisma'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { Prisma } from '@klicker-uzh/prisma/client'
import {
  buildSnapshot,
  DOC_QUERY_SERVER_NAME,
  DOC_QUERY_TOOL_ALIAS,
  describePlan,
  equalJson,
  hasDocQueryToolDefinition,
  isPlainObject,
  type ProvisionArgs,
  ProvisionFailure,
  type ProvisionSnapshot,
  type ProvisionState,
  parseArgs,
  parseSnapshot,
  planProvision,
  projectDocQueryParameters,
} from './lib/chatbotKnowledgeBaseScope.js'

const SERIALIZABLE_RETRY_LIMIT = 3

type ReadClient = Pick<
  PrismaClient,
  | 'chatbot'
  | 'user'
  | 'kB'
  | 'kBChatbot'
  | 'chatbotMCPConfig'
  | 'chatbotMCPServer'
>

const CONFIG_SELECT = {
  id: true,
  chatMode: true,
  isEnabled: true,
  allowedTools: true,
  parameters: true,
} as const

async function readState(
  client: ReadClient,
  args: ProvisionArgs
): Promise<ProvisionState> {
  const chatbot = await client.chatbot.findUnique({
    where: { id: args.chatbotId },
    select: {
      id: true,
      name: true,
      ownerId: true,
      courseId: true,
      course: { select: { ownerId: true } },
    },
  })
  const owner = await client.user.findFirst({
    where: { email: { equals: args.ownerEmail, mode: 'insensitive' } },
    select: { id: true, email: true },
  })
  const kbById = await client.kB.findUnique({
    where: { id: args.kbId },
    select: { id: true, name: true, ownerId: true, deletedAt: true },
  })
  const kbNameConflicts = await client.kB.findMany({
    where: { name: args.kbName, id: { not: args.kbId } },
    select: { id: true },
  })
  const bindings = await client.kBChatbot.findMany({
    where: { chatbotId: args.chatbotId },
    select: { id: true, kbId: true, isEnabled: true },
  })
  const kbServerConfigs = await client.chatbotMCPConfig.findMany({
    where: {
      chatbotId: args.chatbotId,
      mcpServer: { name: DOC_QUERY_SERVER_NAME },
    },
    select: CONFIG_SELECT,
    orderBy: { chatMode: 'asc' },
  })

  const legacyServer = args.legacyServerName
    ? await client.chatbotMCPServer.findUnique({
        where: { name: args.legacyServerName },
        select: { id: true, name: true, isActive: true },
      })
    : null
  const legacyServerConfigs = legacyServer
    ? await client.chatbotMCPConfig.findMany({
        where: { chatbotId: args.chatbotId, mcpServerId: legacyServer.id },
        select: CONFIG_SELECT,
        orderBy: { chatMode: 'asc' },
      })
    : []
  const legacyServerOtherEnabledConfigs = legacyServer
    ? await client.chatbotMCPConfig.count({
        where: {
          mcpServerId: legacyServer.id,
          isEnabled: true,
          chatbotId: { not: args.chatbotId },
        },
      })
    : 0

  return {
    chatbot: chatbot
      ? {
          id: chatbot.id,
          name: chatbot.name,
          ownerId: chatbot.ownerId,
          courseId: chatbot.courseId,
          courseOwnerId: chatbot.course.ownerId,
        }
      : null,
    owner,
    kbById,
    kbNameConflictIds: kbNameConflicts.map(({ id }) => id),
    bindings,
    kbServerConfigs,
    legacyServer,
    legacyServerConfigs,
    legacyServerOtherEnabledConfigs,
  }
}

function isSerializationConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2034'
  )
}

async function applyInTransaction(
  args: ProvisionArgs,
  ownerId: string
): Promise<{
  kbId: string
  bindingId: string
  snapshot: ProvisionSnapshot
  configIds: string[]
}> {
  let lastError: unknown
  for (let attempt = 0; attempt < SERIALIZABLE_RETRY_LIMIT; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          // Re-validate inside the transaction so a concurrent edit fails
          // closed instead of being overwritten.
          const state = await readState(tx, args)
          const plan = planProvision(state, {
            kbId: args.kbId,
            kbName: args.kbName,
            legacyServerName: args.legacyServerName,
          })
          if (plan.refusal) throw new ProvisionFailure(plan.refusal)
          if (!state.owner || state.owner.id !== ownerId) {
            throw new ProvisionFailure('owner_changed_during_apply')
          }

          const snapshot = buildSnapshot(state, plan, {
            chatbotId: args.chatbotId,
            kbId: args.kbId,
            kbName: args.kbName,
          })

          if (plan.createKb) {
            await tx.kB.create({
              data: {
                id: args.kbId,
                name: args.kbName,
                description: args.description,
                ownerId,
              },
            })
          }

          let bindingId = snapshot.binding?.id ?? null
          if (bindingId === null) {
            const created = await tx.kBChatbot.create({
              data: { kbId: args.kbId, chatbotId: args.chatbotId },
              select: { id: true },
            })
            bindingId = created.id
          } else if (snapshot.binding?.isEnabled !== true) {
            await tx.kBChatbot.update({
              where: { id: bindingId },
              data: { isEnabled: true },
            })
          }

          for (const update of plan.configUpdates) {
            await tx.chatbotMCPConfig.update({
              where: { id: update.id },
              data: {
                isEnabled: true,
                allowedTools: [DOC_QUERY_TOOL_ALIAS],
                parameters: update.parameters,
              },
            })
          }

          for (const legacy of plan.legacyConfigDisables) {
            await tx.chatbotMCPConfig.update({
              where: { id: legacy.id },
              data: { isEnabled: false },
            })
          }

          if (plan.deactivateLegacyServer && state.legacyServer) {
            await tx.chatbotMCPServer.update({
              where: { id: state.legacyServer.id },
              data: { isActive: false },
            })
          }

          return {
            kbId: args.kbId,
            bindingId,
            snapshot,
            configIds: plan.configUpdates.map(({ id }) => id),
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      )
    } catch (error) {
      lastError = error
      if (
        isSerializationConflict(error) &&
        attempt < SERIALIZABLE_RETRY_LIMIT - 1
      ) {
        continue
      }
      throw error
    }
  }
  throw lastError ?? new ProvisionFailure('concurrent_change')
}

async function verifyApplied(args: ProvisionArgs, ownerId: string) {
  const kb = await prisma.kB.findUnique({
    where: { id: args.kbId },
    select: { id: true, name: true, ownerId: true, deletedAt: true },
  })
  if (
    !kb ||
    kb.ownerId !== ownerId ||
    kb.name !== args.kbName ||
    kb.deletedAt !== null
  ) {
    throw new ProvisionFailure('post_apply_readback_mismatch', 'kb')
  }
  const binding = await prisma.kBChatbot.findUnique({
    where: { kbId_chatbotId: { kbId: args.kbId, chatbotId: args.chatbotId } },
    select: { id: true, isEnabled: true },
  })
  if (!binding || binding.isEnabled !== true) {
    throw new ProvisionFailure('post_apply_readback_mismatch', 'binding')
  }

  const state = await readState(prisma, args)
  for (const config of state.kbServerConfigs) {
    const expected = projectDocQueryParameters(config.parameters, [args.kbId])
    if (
      config.isEnabled !== true ||
      !equalJson(config.parameters, expected) ||
      !hasDocQueryToolDefinition(config.allowedTools)
    ) {
      throw new ProvisionFailure(
        'post_apply_readback_mismatch',
        'config=' + config.id
      )
    }
  }
  if (
    args.legacyServerName &&
    state.legacyServerConfigs.some((config) => config.isEnabled)
  ) {
    throw new ProvisionFailure(
      'post_apply_readback_mismatch',
      'legacy_config_enabled'
    )
  }
  if (
    args.legacyServerName &&
    state.legacyServer?.isActive === true &&
    state.legacyServerOtherEnabledConfigs === 0 &&
    state.legacyServerConfigs.length > 0
  ) {
    throw new ProvisionFailure(
      'post_apply_readback_mismatch',
      'legacy_server_active'
    )
  }

  return { bindingId: binding.id, configCount: state.kbServerConfigs.length }
}

async function rollback(snapshotPath: string) {
  let snapshot: ProvisionSnapshot
  try {
    snapshot = parseSnapshot(readFileSync(snapshotPath, 'utf8'))
  } catch (error) {
    if (error instanceof ProvisionFailure) throw error
    throw new ProvisionFailure('snapshot_unreadable')
  }

  const kb = await prisma.kB.findUnique({
    where: { id: snapshot.kbId },
    select: { id: true, _count: { select: { resources: true } } },
  })
  const foreignBindings = kb
    ? await prisma.kBChatbot.count({
        where: {
          kbId: snapshot.kbId,
          chatbotId: { not: snapshot.chatbotId },
        },
      })
    : 0

  const result = await prisma.$transaction(
    async (tx) => {
      const currentConfigs = await tx.$queryRaw<Array<{ parameters: unknown }>>`
        SELECT parameters FROM "ChatbotMCPConfig"
        WHERE "chatbotId" = ${snapshot.chatbotId}::uuid
        ORDER BY id FOR UPDATE
      `
      if (
        [...currentConfigs, ...snapshot.configs].some(
          ({ parameters }) =>
            isPlainObject(parameters) &&
            Object.hasOwn(parameters, 'shared_kb_ids')
        )
      ) {
        throw new ProvisionFailure('shared_kb_grants_require_operator')
      }
      for (const config of snapshot.configs) {
        await tx.chatbotMCPConfig.updateMany({
          where: { id: config.id },
          data: {
            isEnabled: config.isEnabled,
            parameters: config.parameters as Prisma.InputJsonObject,
          },
        })
      }
      for (const legacy of snapshot.legacyConfigs) {
        await tx.chatbotMCPConfig.updateMany({
          where: { id: legacy.id },
          data: { isEnabled: legacy.isEnabled },
        })
      }
      if (snapshot.legacyServer) {
        await tx.chatbotMCPServer.updateMany({
          where: { id: snapshot.legacyServer.id },
          data: { isActive: snapshot.legacyServer.isActive },
        })
      }

      let bindingRestored = false
      let kbRemoved = false
      if (snapshot.binding) {
        const restored = await tx.kBChatbot.updateMany({
          where: { id: snapshot.binding.id },
          data: { isEnabled: snapshot.binding.isEnabled },
        })
        bindingRestored = restored.count === 1
      } else if (snapshot.kbWasCreated && kb) {
        // Only a knowledge base this run created, with no uploaded resource
        // and no other chatbot attached, may disappear again.
        if (kb._count.resources > 0 || foreignBindings > 0) {
          throw new ProvisionFailure('rollback_kb_in_use')
        }
        await tx.kBChatbot.deleteMany({
          where: { kbId: snapshot.kbId, chatbotId: snapshot.chatbotId },
        })
        const removed = await tx.kB.deleteMany({ where: { id: snapshot.kbId } })
        kbRemoved = removed.count === 1
      }

      return { bindingRestored, kbRemoved }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  )

  console.log(
    `ROLLED_BACK kbId=${snapshot.kbId} bindingRestored=${result.bindingRestored} kbRemoved=${result.kbRemoved} configs=${snapshot.configs.length}`
  )
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.rollback) {
    await rollback(args.snapshotPath ?? '')
    return
  }

  const state = await readState(prisma, args)
  const plan = planProvision(state, {
    kbId: args.kbId,
    kbName: args.kbName,
    legacyServerName: args.legacyServerName,
  })

  console.log(describePlan(args, state, plan))
  if (plan.refusal) {
    throw new ProvisionFailure(plan.refusal)
  }
  const owner = state.owner
  if (!owner) throw new ProvisionFailure('owner_not_found')

  if (!args.apply) {
    console.log('Dry run only. Re-run with --apply to write.')
    return
  }

  const result = await applyInTransaction(args, owner.id)
  writeFileSync(
    args.snapshotPath ?? '',
    JSON.stringify(result.snapshot, null, 2)
  )
  const verified = await verifyApplied(args, owner.id)
  console.log(
    `APPLIED kbId=${result.kbId} bindingId=${verified.bindingId} configs=${verified.configCount} snapshot=${args.snapshotPath}`
  )
}

try {
  await main()
} catch (error) {
  if (error instanceof ProvisionFailure) {
    console.log(error.message)
  } else {
    console.log(`FAIL: unexpected ${(error as Error).message}`)
  }
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
