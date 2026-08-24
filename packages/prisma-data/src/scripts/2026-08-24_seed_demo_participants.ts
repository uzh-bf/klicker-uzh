import * as DB from '@klicker-uzh/prisma/client'
import { prisma } from '@klicker-uzh/prisma'
import bcrypt from 'bcryptjs'

const APPLY_FLAG = '--apply'
const READBACK_FLAG = '--readback'
const HELP_FLAG = '--help'
const OWNER_SHORTNAME = 'klick'
const SHARED_TEST_USERNAME = 'teststudent'

const TARGETS = [
  {
    label: 'IuW',
    courseName: 'testkurs IuW',
    chatbotName: 'Informatik und Wirtschaft',
    username: 'teststudent-iuw',
    passwordEnv: 'KLICKER_DEMO_IUW_PARTICIPANT_PASSWORD',
  },
  {
    label: 'RadioSurfVet',
    courseName: 'testkurs RadioSurfVet',
    chatbotName: 'RadioSurfVet',
    username: 'teststudent-rsv',
    passwordEnv: 'KLICKER_DEMO_RADIOSURFVET_PARTICIPANT_PASSWORD',
  },
  {
    label: 'Culture',
    courseName: 'KlickerUZH Demo Copy',
    chatbotName: 'Culture Scenario Lab',
    username: 'teststudent-culture',
    passwordEnv: 'KLICKER_DEMO_CULTURE_PARTICIPANT_PASSWORD',
  },
] as const

type Target = (typeof TARGETS)[number]

type ResolvedTarget = Target & {
  courseId: string
  chatbotId: string
}

type ParticipantState = {
  id: string
  isActive: boolean
  isProfilePublic: boolean
  isSSOAccount: boolean
  password: string
  participations: Array<{
    courseId: string
    isActive: boolean
  }>
}

class SeedError extends Error {
  constructor(readonly code: string) {
    super(code)
  }
}

function usage() {
  return [
    'Usage:',
    '  tsx src/scripts/2026-08-24_seed_demo_participants.ts',
    '  tsx src/scripts/2026-08-24_seed_demo_participants.ts --readback',
    '  tsx src/scripts/2026-08-24_seed_demo_participants.ts --apply',
    '',
    'Default mode is a values-free dry run. --readback is read-only.',
    '--apply requires the three operator-injected password variables.',
  ].join('\n')
}

function parseMode(args: Array<string>) {
  const unknown = args.filter(
    (arg) => ![APPLY_FLAG, READBACK_FLAG, HELP_FLAG].includes(arg)
  )
  if (unknown.length > 0) throw new SeedError('unknown_argument')

  const modes = args.filter((arg) => [APPLY_FLAG, READBACK_FLAG].includes(arg))
  if (modes.length > 1) throw new SeedError('conflicting_mode')

  if (args.includes(HELP_FLAG)) return 'help' as const
  if (args.includes(APPLY_FLAG)) return 'apply' as const
  if (args.includes(READBACK_FLAG)) return 'readback' as const
  return 'dry-run' as const
}

function getPassword(target: Target) {
  const password = process.env[target.passwordEnv]
  if (!password || password.length < 16) {
    throw new SeedError(`missing_password_${target.label}`)
  }
  return password
}

async function resolveTargets(
  client: Pick<DB.PrismaClient, 'user' | 'course'>
): Promise<Array<ResolvedTarget>> {
  const owner = await client.user.findUnique({
    where: { shortname: OWNER_SHORTNAME },
    select: { id: true },
  })
  if (!owner) throw new SeedError('owner_not_found')

  const resolved: Array<ResolvedTarget> = []
  for (const target of TARGETS) {
    const courses = await client.course.findMany({
      where: {
        ownerId: owner.id,
        name: target.courseName,
        isArchived: false,
      },
      select: {
        id: true,
        chatbots: {
          where: {
            ownerId: owner.id,
            name: target.chatbotName,
          },
          select: { id: true },
        },
      },
    })

    const courseMatch = courses.length === 1
    const chatbotMatch = courseMatch && courses[0]!.chatbots.length === 1
    console.log(
      `target=${target.label} courseMatch=${courseMatch} chatbotMatch=${chatbotMatch}`
    )

    if (!courseMatch || !chatbotMatch) {
      throw new SeedError(`target_resolution_${target.label}`)
    }

    resolved.push({
      ...target,
      courseId: courses[0]!.id,
      chatbotId: courses[0]!.chatbots[0]!.id,
    })
  }

  return resolved
}

async function getParticipantState(
  client: Pick<DB.PrismaClient, 'participant'>,
  username: string
): Promise<ParticipantState | null> {
  const participant = await client.participant.findUnique({
    where: { username },
    select: {
      id: true,
      isActive: true,
      isProfilePublic: true,
      isSSOAccount: true,
      password: true,
      participations: {
        select: { courseId: true, isActive: true },
      },
    },
  })

  return participant
}

function assertParticipantScope(
  target: ResolvedTarget,
  participant: ParticipantState | null
) {
  if (target.username === SHARED_TEST_USERNAME) {
    throw new SeedError('shared_account_denied')
  }
  if (participant?.isSSOAccount) {
    throw new SeedError(`sso_account_${target.label}`)
  }
}

function getStateBooleans(
  target: ResolvedTarget,
  participant: ParticipantState | null
) {
  const targetParticipation = participant?.participations.find(
    (participation) => participation.courseId === target.courseId
  )
  const activeOffTarget = participant?.participations.some(
    (participation) =>
      participation.courseId !== target.courseId && participation.isActive
  )

  return {
    accountExisting: Boolean(participant),
    accountActive: participant?.isActive ?? false,
    accountPrivate: participant ? !participant.isProfilePublic : true,
    accountManual: participant ? !participant.isSSOAccount : true,
    targetParticipationActive: targetParticipation?.isActive ?? false,
    activeOffTargetParticipation: activeOffTarget ?? false,
  }
}

async function printState(
  client: Pick<DB.PrismaClient, 'participant'>,
  targets: Array<ResolvedTarget>
) {
  for (const target of targets) {
    const participant = await getParticipantState(client, target.username)
    assertParticipantScope(target, participant)
    const state = getStateBooleans(target, participant)
    console.log(
      [
        `target=${target.label}`,
        `accountExisting=${state.accountExisting}`,
        `accountActive=${state.accountActive}`,
        `accountPrivate=${state.accountPrivate}`,
        `accountManual=${state.accountManual}`,
        `targetParticipationActive=${state.targetParticipationActive}`,
        `activeOffTargetParticipation=${state.activeOffTargetParticipation}`,
      ].join(' ')
    )
  }
}

async function verifyReadbackState(
  client: Pick<DB.PrismaClient, 'participant'>,
  targets: Array<ResolvedTarget>
) {
  for (const target of targets) {
    const participant = await getParticipantState(client, target.username)
    assertParticipantScope(target, participant)
    if (!participant) {
      throw new SeedError(`missing_on_readback_${target.label}`)
    }

    const state = getStateBooleans(target, participant)
    const activeOnlyInTarget =
      state.targetParticipationActive && !state.activeOffTargetParticipation

    console.log(
      [
        `target=${target.label}`,
        `accountActive=${state.accountActive}`,
        `accountPrivate=${state.accountPrivate}`,
        `accountManual=${state.accountManual}`,
        `activeOnlyInTarget=${activeOnlyInTarget}`,
      ].join(' ')
    )

    if (
      !state.accountActive ||
      !state.accountPrivate ||
      !state.accountManual ||
      !activeOnlyInTarget
    ) {
      throw new SeedError(`readback_invariant_${target.label}`)
    }
  }
}

async function reconcileParticipant(
  client: Pick<DB.PrismaClient, 'participant' | 'participation'>,
  target: ResolvedTarget,
  password: string
) {
  const existing = await getParticipantState(client, target.username)
  assertParticipantScope(target, existing)

  let participantId: string
  if (!existing) {
    const created = await client.participant.create({
      data: {
        username: target.username,
        password: await bcrypt.hash(password, 12),
        isActive: true,
        isProfilePublic: false,
        isEmailValid: false,
        isSSOAccount: false,
      },
      select: { id: true },
    })
    participantId = created.id
  } else {
    participantId = existing.id
    const passwordMatches = await bcrypt.compare(password, existing.password)
    const needsAccountUpdate =
      !passwordMatches || !existing.isActive || existing.isProfilePublic

    if (needsAccountUpdate) {
      await client.participant.update({
        where: { id: existing.id },
        data: {
          password: passwordMatches
            ? undefined
            : await bcrypt.hash(password, 12),
          isActive: true,
          isProfilePublic: false,
        },
      })
    }
  }

  if (
    existing?.participations.some(
      (participation) =>
        participation.courseId !== target.courseId && participation.isActive
    )
  ) {
    await client.participation.updateMany({
      where: {
        participantId,
        courseId: { not: target.courseId },
        isActive: true,
      },
      data: { isActive: false },
    })
  }

  const targetParticipation = existing?.participations.find(
    (participation) => participation.courseId === target.courseId
  )
  if (!targetParticipation?.isActive) {
    await client.participation.upsert({
      where: {
        courseId_participantId: {
          courseId: target.courseId,
          participantId,
        },
      },
      create: {
        courseId: target.courseId,
        participantId,
        isActive: true,
      },
      update: { isActive: true },
    })
  }
}

async function verifyAppliedState(
  client: Pick<DB.PrismaClient, 'participant'>,
  targets: Array<ResolvedTarget>,
  passwords: Map<string, string>
) {
  for (const target of targets) {
    const participant = await getParticipantState(client, target.username)
    assertParticipantScope(target, participant)
    if (!participant) throw new SeedError(`missing_after_apply_${target.label}`)

    const password = passwords.get(target.label)
    const passwordMatches = password
      ? await bcrypt.compare(password, participant.password)
      : false
    const state = getStateBooleans(target, participant)
    const activeOnlyInTarget =
      state.targetParticipationActive && !state.activeOffTargetParticipation

    console.log(
      [
        `target=${target.label}`,
        `accountActive=${state.accountActive}`,
        `accountPrivate=${state.accountPrivate}`,
        `accountManual=${state.accountManual}`,
        `passwordMatches=${passwordMatches}`,
        `activeOnlyInTarget=${activeOnlyInTarget}`,
      ].join(' ')
    )

    if (
      !state.accountActive ||
      !state.accountPrivate ||
      !state.accountManual ||
      !passwordMatches ||
      !activeOnlyInTarget
    ) {
      throw new SeedError(`post_apply_invariant_${target.label}`)
    }
  }
}

async function run() {
  const mode = parseMode(process.argv.slice(2))
  if (mode === 'help') {
    console.log(usage())
    return
  }

  const targets = await resolveTargets(prisma)

  if (mode === 'dry-run') {
    await printState(prisma, targets)
    console.log(`mode=${mode} writes=false`)
    return
  }

  if (mode === 'readback') {
    await verifyReadbackState(prisma, targets)
    console.log(`mode=${mode} writes=false`)
    return
  }

  const passwords = new Map<string, string>()
  for (const target of targets) {
    passwords.set(target.label, getPassword(target))
  }

  await prisma.$transaction(
    async (transaction) => {
      const freshTargets = await resolveTargets(transaction)
      for (const target of freshTargets) {
        const password = passwords.get(target.label)
        if (!password) throw new SeedError(`missing_password_${target.label}`)
        await reconcileParticipant(transaction, target, password)
      }
      await verifyAppliedState(transaction, freshTargets, passwords)
    },
    { isolationLevel: DB.Prisma.TransactionIsolationLevel.Serializable }
  )

  console.log('mode=apply writes=true')
}

try {
  await run()
} catch (error) {
  if (error instanceof SeedError) {
    console.error(`status=failed code=${error.code}`)
  } else {
    console.error('status=failed code=unexpected_error')
  }
  process.exitCode = 1
}

try {
  await prisma.$disconnect()
} catch {
  console.error('status=failed code=disconnect_error')
  process.exitCode = 1
}
