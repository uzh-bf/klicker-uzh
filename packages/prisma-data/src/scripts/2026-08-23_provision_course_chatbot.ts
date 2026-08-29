import { readFileSync } from 'node:fs'
import {
  appendChatbotModePromptVersion,
  ensureChatbotPromptCatalog,
  prisma,
  projectLegacySystemPrompts,
  updateChatbotModePresentation,
} from '@klicker-uzh/prisma'
import type { PromptCatalogModeInput } from '@klicker-uzh/prisma'
import { Prisma } from '@klicker-uzh/prisma/client'

const APPLY_FLAG = '--apply'

type ModePrompt = { prompt: string; description: string }

type ProvisionConfig = {
  chatbotName: string
  chatbotDescription: string
  courseNameMarker: string
  demoNamePrefix: string
  disclaimerName: string
  disclaimerTitle: string
  disclaimerIntroText: string
  systemPrompts: Record<string, ModePrompt>
}

function readFlag(argv: Array<string>, name: string): string | undefined {
  const index = argv.indexOf(name)
  return index === -1 ? undefined : argv[index + 1]
}

function parseArgs(argv: Array<string>) {
  const apply = argv.includes(APPLY_FLAG)
  const configPath = readFlag(argv, '--config')
  const courseId = readFlag(argv, '--course-id')
  const ownerId = readFlag(argv, '--owner-id')
  if (!configPath || !courseId || !ownerId) {
    throw new Error(
      'Usage: tsx <script> --config <config.json> --course-id <uuid> --owner-id <uuid> [--apply]'
    )
  }
  return { apply, configPath, courseId, ownerId }
}

function loadConfig(configPath: string): ProvisionConfig {
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(configPath, 'utf8'))
  } catch (error) {
    throw new Error(`FAIL config_unreadable error=${(error as Error).message}`)
  }
  const config = raw as Partial<ProvisionConfig>
  for (const key of [
    'chatbotName',
    'chatbotDescription',
    'courseNameMarker',
    'demoNamePrefix',
    'disclaimerName',
    'disclaimerTitle',
    'disclaimerIntroText',
  ] as const) {
    if (typeof config[key] !== 'string' || config[key].length === 0) {
      throw new Error(`FAIL: config_invalid key=${key}`)
    }
  }
  if (
    !config.systemPrompts ||
    typeof config.systemPrompts !== 'object' ||
    Object.keys(config.systemPrompts).length === 0
  ) {
    throw new Error('FAIL: config_invalid key=systemPrompts')
  }
  for (const [mode, prompt] of Object.entries(config.systemPrompts)) {
    if (
      !prompt ||
      typeof prompt.prompt !== 'string' ||
      prompt.prompt.length === 0 ||
      typeof prompt.description !== 'string'
    ) {
      throw new Error(`FAIL: config_invalid mode=${mode}`)
    }
  }
  return config as ProvisionConfig
}

async function resolveTargetState(input: {
  courseId: string
  ownerId: string
}) {
  const [course, owner, existingChatbots] = await Promise.all([
    prisma.course.findUnique({
      where: { id: input.courseId },
      select: { id: true, displayName: true, ownerId: true, isArchived: true },
    }),
    prisma.user.findUnique({
      where: { id: input.ownerId },
      select: { id: true, shortname: true },
    }),
    prisma.chatbot.findMany({
      where: { courseId: input.courseId },
      select: { id: true, name: true, modelSelection: true },
    }),
  ])
  return { course, owner, existingChatbots }
}

function findConflicts(
  chatbots: Array<{ name: string }>,
  chatbotName: string,
  demoNamePrefix: string
) {
  // Any other demo-prefixed bot would make ownership of the demo lane ambiguous.
  return chatbots.filter(
    (chatbot) =>
      chatbot.name !== chatbotName && chatbot.name.startsWith(demoNamePrefix)
  )
}

function configuredModes(
  systemPrompts: Record<string, ModePrompt>
): PromptCatalogModeInput[] {
  return Object.entries(systemPrompts).map(([key, value]) => ({
    key,
    prompt: value.prompt,
    description: value.description,
  }))
}

function requireSameModeKeys(
  current: readonly { key: string }[],
  desired: readonly { key: string }[]
): void {
  const currentKeys = current.map((mode) => mode.key).sort()
  const desiredKeys = desired.map((mode) => mode.key).sort()
  if (
    currentKeys.length !== desiredKeys.length ||
    currentKeys.some((key, index) => key !== desiredKeys[index])
  ) {
    throw new Error('FAIL: prompt_mode_set_mismatch')
  }
}

async function main() {
  let args
  let config
  try {
    args = parseArgs(process.argv.slice(2))
    config = loadConfig(args.configPath)
  } catch (error) {
    console.log((error as Error).message)
    process.exitCode = 1
    return
  }

  const { course, owner, existingChatbots } = await resolveTargetState(args)

  if (!course) {
    console.log(`FAIL: course_not_found courseId=${args.courseId}`)
    process.exitCode = 1
    return
  }
  if (!owner) {
    console.log(`FAIL: owner_not_found ownerId=${args.ownerId}`)
    process.exitCode = 1
    return
  }
  if (!course.displayName.includes(config.courseNameMarker)) {
    console.log('FAIL: course_name_missing_marker - refusing write')
    process.exitCode = 1
    return
  }
  if (course.ownerId !== owner.id) {
    console.log('FAIL: course_owner_mismatch - refusing write')
    process.exitCode = 1
    return
  }

  const exactMatch = existingChatbots.find(
    (chatbot) => chatbot.name === config.chatbotName
  )
  const conflicts = findConflicts(
    existingChatbots,
    config.chatbotName,
    config.demoNamePrefix
  )

  console.log('Plan:')
  console.log(`  action=${exactMatch ? 'none' : 'create_chatbot'}`)
  console.log(`  courseId=${course.id}`)
  console.log(`  courseOwnerMatches=${course.ownerId === owner.id}`)
  console.log(`  courseArchived=${course.isArchived}`)
  console.log(`  chatbotName=${config.chatbotName}`)
  console.log(`  existingCourseChatbots=${existingChatbots.length}`)
  console.log(`  conflictingDemoNames=${conflicts.length}`)

  if (!args.apply) {
    console.log('Dry run only. Re-run with --apply to write.')
    return
  }

  if (conflicts.length > 0) {
    console.log('FAIL: conflicting_demo_chatbots_present - no changes written')
    process.exitCode = 1
    return
  }

  const result = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      // Re-validate inside the transaction so concurrent writes fail closed.
      const [txCourse, txOwner, txExisting] = await Promise.all([
        tx.course.findUnique({
          where: { id: args.courseId },
          select: { id: true, ownerId: true, displayName: true },
        }),
        tx.user.findUnique({
          where: { id: args.ownerId },
          select: { id: true },
        }),
        tx.chatbot.findMany({
          where: { courseId: args.courseId },
          select: { name: true },
        }),
      ])
      if (!txCourse || !txOwner) {
        throw new Error('FAIL: target_vanished_during_apply')
      }
      if (!txCourse.displayName.includes(config.courseNameMarker)) {
        throw new Error('FAIL: course_name_missing_marker')
      }
      if (txCourse.ownerId !== txOwner.id) {
        throw new Error('FAIL: course_owner_mismatch')
      }
      if (
        findConflicts(txExisting, config.chatbotName, config.demoNamePrefix)
          .length > 0
      ) {
        throw new Error('FAIL: conflicting_demo_chatbots_present')
      }

      const existing = await tx.chatbot.findFirst({
        where: { courseId: args.courseId, name: config.chatbotName },
        select: {
          id: true,
          disclaimerId: true,
          systemPrompts: true,
        },
      })

      let disclaimerId = existing?.disclaimerId
      if (disclaimerId) {
        // Reuse the linked disclaimer so replay runs stay idempotent.
        await tx.chatbotDisclaimer.update({
          where: { id: disclaimerId },
          data: { introText: config.disclaimerIntroText },
        })
      } else {
        const disclaimer = await tx.chatbotDisclaimer.create({
          data: {
            name: config.disclaimerName,
            title: config.disclaimerTitle,
            introText: config.disclaimerIntroText,
            ownerId: args.ownerId,
          },
        })
        disclaimerId = disclaimer.id
      }

      const sharedData = {
        modelSelection: false,
        allowedModelIds: [],
        disclaimerId,
      }

      const desiredModes = configuredModes(config.systemPrompts)

      if (existing) {
        const projection = projectLegacySystemPrompts(existing.systemPrompts)
        if (!projection.isValid) {
          throw new Error('FAIL: prompt_projection_invalid')
        }

        // Establish a version-1 baseline for a pre-catalog bot before applying
        // configured changes. Existing catalog state must match the legacy
        // projection exactly or the writer fails closed.
        await ensureChatbotPromptCatalog(tx, existing.id, projection.modes)
        const currentModes = await tx.chatbotMode.findMany({
          where: { chatbotId: existing.id },
          select: {
            key: true,
            description: true,
            status: true,
            activePromptVersion: { select: { authoredPrompt: true } },
          },
        })
        requireSameModeKeys(currentModes, desiredModes)

        for (const desired of desiredModes) {
          const current = currentModes.find((mode) => mode.key === desired.key)!
          if (current.status === 'RETIRED') {
            throw new Error(`FAIL: prompt_mode_retired mode=${desired.key}`)
          }
          if (!current.activePromptVersion) {
            throw new Error(
              `FAIL: prompt_mode_missing_active_version mode=${desired.key}`
            )
          }
          if (current.activePromptVersion.authoredPrompt !== desired.prompt) {
            await appendChatbotModePromptVersion(
              tx,
              existing.id,
              desired.key,
              desired.prompt
            )
          }
          if (current.description !== (desired.description ?? null)) {
            await updateChatbotModePresentation(tx, existing.id, desired.key, {
              description: desired.description ?? null,
            })
          }
        }

        const chatbot = await tx.chatbot.update({
          where: { id: existing.id },
          data: sharedData,
        })
        return { chatbotId: chatbot.id }
      }

      const chatbot = await tx.chatbot.create({
        data: {
          ...sharedData,
          systemPrompts: config.systemPrompts,
          name: config.chatbotName,
          description: config.chatbotDescription,
          ownerId: args.ownerId,
          courseId: args.courseId,
          creditInitialCredits: 100,
          creditResetPeriod: 'WEEKLY',
          creditResetAmount: 100,
          creditMaxCredits: 100,
        },
      })
      await ensureChatbotPromptCatalog(tx, chatbot.id, desiredModes)

      return { chatbotId: chatbot.id }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  )

  const verify = await prisma.chatbot.findUnique({
    where: { id: result.chatbotId },
    select: {
      id: true,
      name: true,
      courseId: true,
      ownerId: true,
      modelSelection: true,
    },
  })
  if (
    !verify ||
    verify.courseId !== args.courseId ||
    verify.ownerId !== args.ownerId ||
    verify.modelSelection !== false
  ) {
    throw new Error('FAIL: post_apply_readback_mismatch')
  }
  console.log(
    `APPLIED chatbotId=${verify.id} modelSelection=${verify.modelSelection}`
  )
}

try {
  await main()
} finally {
  await prisma.$disconnect()
}
