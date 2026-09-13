import { requireDisposableDatabase } from '@klicker-uzh/prisma'
import { encrypt, getZurichMonthStart } from '@klicker-uzh/util'
import bcrypt from 'bcryptjs'
import {
  assertLocalSeedOwnership,
  LOCAL_CHATBOT_ID,
  LOCAL_COURSE_ID,
  LOCAL_COURSE_PIN,
  LOCAL_FIXTURE_MARKER,
  LOCAL_KB_ID,
  LOCAL_OWNER_ID,
  LOCAL_SCOPE,
  LOCAL_SERVER_ID,
  LOCAL_SERVER_NAME,
  LOCAL_SERVER_URL,
} from './local-mcp-auth.mjs'

/**
 * The local bootstrap owns a disposable database, so these identities can be
 * stable without colliding with the ordinary test seed.
 */
export const LOCAL_PARTICIPANT_ID = '76047345-3801-4628-ae7b-adbebcfe8831'
export const LOCAL_USER_LOGIN_ID = '76047345-3801-4628-ae7b-adbebcfe8832'
export const LOCAL_KB_CHATBOT_ID = '76047345-3801-4628-ae7b-adbebcfe8833'
export const LOCAL_TUTOR_CONFIG_ID = '76047345-3801-4628-ae7b-adbebcfe8834'
export const LOCAL_EXPLAINER_CONFIG_ID = '76047345-3801-4628-ae7b-adbebcfe8835'

const LOCAL_USAGE_BUDGET = 100
const LOCAL_CREDIT_BALANCE = 100
const LOCAL_START_DATE = new Date('2020-01-01T00:00:00.000Z')
const LOCAL_END_DATE = new Date('2055-01-01T00:00:00.000Z')

function buildServer(token) {
  return {
    id: LOCAL_SERVER_ID,
    name: LOCAL_SERVER_NAME,
    authType: 'bearer',
    authSecret: encrypt(token),
    parameters: LOCAL_FIXTURE_MARKER,
    url: LOCAL_SERVER_URL,
    isActive: true,
    passChatbotId: false,
    chatbotIdHeader: null,
  }
}

function buildConfigurations() {
  return [
    {
      id: LOCAL_TUTOR_CONFIG_ID,
      mcpServerId: LOCAL_SERVER_ID,
      chatbotId: LOCAL_CHATBOT_ID,
      chatMode: 'tutor',
      isEnabled: true,
      priority: 0,
      allowedTools: ['doc_query'],
      parameters: LOCAL_SCOPE,
    },
    {
      id: LOCAL_EXPLAINER_CONFIG_ID,
      mcpServerId: LOCAL_SERVER_ID,
      chatbotId: LOCAL_CHATBOT_ID,
      chatMode: 'explainer',
      isEnabled: true,
      priority: 0,
      allowedTools: ['doc_query'],
      parameters: LOCAL_SCOPE,
    },
  ]
}

function isSeededLecturer(user) {
  return (
    user?.id === LOCAL_OWNER_ID &&
    user.shortname === 'lecturer' &&
    user.aiFeaturesEnabled === true &&
    user.betaEnabled === true
  )
}

function isDedicatedParent(chatbot, course) {
  return (
    chatbot?.id === LOCAL_CHATBOT_ID &&
    chatbot.ownerId === LOCAL_OWNER_ID &&
    chatbot.courseId === LOCAL_COURSE_ID &&
    chatbot.status === 'PUBLISHED' &&
    course?.id === LOCAL_COURSE_ID &&
    course.ownerId === LOCAL_OWNER_ID &&
    course.pinCode === LOCAL_COURSE_PIN
  )
}

function assertNotInterrupted(interrupted) {
  if (interrupted()) throw new Error('Local MCP startup interrupted')
}

function isEmptyDomain(state) {
  return Object.values(state).every((rows) => rows.length === 0)
}

function exactSingleRow(rows, predicate) {
  return rows.length === 1 && predicate(rows[0])
}

function isCompleteDomain(state) {
  const configurations = state.configurations
  const chatbot = state.chatbots[0]
  const course = state.courses[0]
  const owner = state.users[0]
  const server = state.servers[0]

  if (
    !exactSingleRow(state.users, isSeededLecturer) ||
    !exactSingleRow(
      state.userLogins,
      (login) =>
        login.id === LOCAL_USER_LOGIN_ID &&
        login.userId === LOCAL_OWNER_ID &&
        login.name === 'lecturer' &&
        login.scope === 'FULL_ACCESS'
    ) ||
    !exactSingleRow(
      state.participants,
      (participant) =>
        participant.id === LOCAL_PARTICIPANT_ID &&
        participant.username === 'testuser1' &&
        participant.isActive === true
    ) ||
    !exactSingleRow(
      state.courses,
      (candidate) =>
        candidate.id === LOCAL_COURSE_ID &&
        candidate.ownerId === LOCAL_OWNER_ID &&
        candidate.pinCode === LOCAL_COURSE_PIN
    ) ||
    !exactSingleRow(
      state.participations,
      (participation) =>
        participation.courseId === LOCAL_COURSE_ID &&
        participation.participantId === LOCAL_PARTICIPANT_ID
    ) ||
    !exactSingleRow(state.chatbots, (candidate) =>
      isDedicatedParent(candidate, course)
    ) ||
    !exactSingleRow(
      state.kbs,
      (kb) =>
        kb.id === LOCAL_KB_ID &&
        kb.ownerId === LOCAL_OWNER_ID &&
        kb.deletedAt === null
    ) ||
    !exactSingleRow(
      state.kbChatbots,
      (binding) =>
        binding.id === LOCAL_KB_CHATBOT_ID &&
        binding.kbId === LOCAL_KB_ID &&
        binding.chatbotId === LOCAL_CHATBOT_ID &&
        binding.isEnabled === true
    ) ||
    !exactSingleRow(
      state.usageCredits,
      (credits) =>
        credits.participantId === LOCAL_PARTICIPANT_ID &&
        credits.chatbotId === LOCAL_CHATBOT_ID
    ) ||
    state.accountUsages.length !== 2 ||
    state.accountUsages.some(
      (usage) =>
        usage.ownerId !== LOCAL_OWNER_ID ||
        !['BASE', 'ADVANCED'].includes(usage.usageClass)
    ) ||
    state.servers.length !== 1 ||
    state.configurations.length !== 2 ||
    owner === undefined ||
    server === undefined
  ) {
    return false
  }

  try {
    assertLocalSeedOwnership(server, configurations, chatbot)
    return true
  } catch {
    return false
  }
}

function hasNameCollision(server, nameMatches) {
  return (
    nameMatches.some((row) => row.id !== LOCAL_SERVER_ID) ||
    (server === undefined && nameMatches.length !== 0)
  )
}

function hasUnexpectedChatbotConsumer(configurations) {
  return configurations.some(
    (config) =>
      config.chatbotId === LOCAL_CHATBOT_ID &&
      config.mcpServerId !== LOCAL_SERVER_ID
  )
}

async function readDomainState(tx) {
  const [
    users,
    userLogins,
    participants,
    courses,
    participations,
    chatbots,
    kbs,
    kbChatbots,
    servers,
    configurations,
    usageCredits,
    accountUsages,
  ] = await Promise.all([
    tx.user.findMany({
      select: {
        id: true,
        shortname: true,
        aiFeaturesEnabled: true,
        betaEnabled: true,
      },
    }),
    tx.userLogin.findMany({
      select: { id: true, userId: true, name: true, scope: true },
    }),
    tx.participant.findMany({
      select: { id: true, username: true, isActive: true },
    }),
    tx.course.findMany({
      select: { id: true, ownerId: true, pinCode: true },
    }),
    tx.participation.findMany({
      select: {
        id: true,
        courseId: true,
        participantId: true,
        isActive: true,
      },
    }),
    tx.chatbot.findMany({
      select: { id: true, ownerId: true, courseId: true, status: true },
    }),
    tx.kB.findMany({
      select: { id: true, ownerId: true, deletedAt: true },
    }),
    tx.kBChatbot.findMany({
      select: { id: true, kbId: true, chatbotId: true, isEnabled: true },
    }),
    tx.chatbotMCPServer.findMany({
      select: {
        id: true,
        name: true,
        url: true,
        authType: true,
        authSecret: true,
        parameters: true,
        isActive: true,
        passChatbotId: true,
        chatbotIdHeader: true,
      },
    }),
    tx.chatbotMCPConfig.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        mcpServerId: true,
        chatbotId: true,
        chatMode: true,
        isEnabled: true,
        priority: true,
        allowedTools: true,
        parameters: true,
      },
    }),
    tx.chatUsageCredits.findMany({
      select: { participantId: true, chatbotId: true },
    }),
    tx.chatAccountUsage.findMany({
      select: { ownerId: true, usageClass: true, monthStart: true },
    }),
  ])

  return {
    accountUsages,
    chatbots,
    configurations,
    courses,
    kbChatbots,
    kbs,
    participants,
    participations,
    servers,
    usageCredits,
    userLogins,
    users,
  }
}

async function createOwner(tx, password) {
  await tx.user.create({
    data: {
      id: LOCAL_OWNER_ID,
      name: 'Lecturer',
      email: 'lecturer@local.test',
      shortname: 'lecturer',
      role: 'ADMIN',
      aiFeaturesEnabled: true,
      betaEnabled: true,
      catalystInstitutional: true,
      catalystIndividual: true,
      publicPreview: true,
      privatePreview: true,
      firstLogin: false,
      logins: {
        create: {
          id: LOCAL_USER_LOGIN_ID,
          name: 'lecturer',
          password,
          scope: 'FULL_ACCESS',
        },
      },
    },
  })
}

async function createCourse(tx) {
  await tx.course.create({
    data: {
      id: LOCAL_COURSE_ID,
      ownerId: LOCAL_OWNER_ID,
      name: 'Synthetic local MCP course',
      displayName: 'Synthetic local MCP course',
      description: 'Synthetic course for the disposable local MCP runtime.',
      authType: 'PIN',
      pinCode: LOCAL_COURSE_PIN,
      startDate: LOCAL_START_DATE,
      endDate: LOCAL_END_DATE,
      groupDeadlineDate: LOCAL_END_DATE,
      isGamificationEnabled: false,
      isGroupCreationEnabled: false,
    },
  })
}

async function createParticipant(tx, password) {
  await tx.participant.create({
    data: {
      id: LOCAL_PARTICIPANT_ID,
      username: 'testuser1',
      email: 'testuser1@local.test',
      password,
      isActive: true,
      isProfilePublic: true,
      isSSOAccount: false,
    },
  })

  // Participation.isActive is leaderboard opt-in, not course or chat access.
  await tx.participation.create({
    data: {
      courseId: LOCAL_COURSE_ID,
      participantId: LOCAL_PARTICIPANT_ID,
      isActive: false,
    },
  })
}

async function createChatbot(tx) {
  await tx.chatbot.create({
    data: {
      id: LOCAL_CHATBOT_ID,
      ownerId: LOCAL_OWNER_ID,
      courseId: LOCAL_COURSE_ID,
      name: 'Local MCP Tutor',
      description: 'Synthetic chatbot for local MCP integration checks.',
      systemPrompts: {
        tutor: {
          prompt: 'Answer as a concise tutor for the local MCP fixture.',
          description: 'Synthetic tutor mode.',
        },
        explainer: {
          prompt: 'Explain answers clearly for the local MCP fixture.',
          description: 'Synthetic explainer mode.',
        },
      },
      creditInitialCredits: LOCAL_CREDIT_BALANCE,
      creditResetPeriod: 'WEEKLY',
      creditResetAmount: 50,
      creditMaxCredits: LOCAL_CREDIT_BALANCE,
      modelSelection: false,
      allowedModelIds: ['auto'],
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
  })
}

async function createKnowledgeBase(tx) {
  await tx.kB.create({
    data: {
      id: LOCAL_KB_ID,
      ownerId: LOCAL_OWNER_ID,
      name: 'Local MCP knowledge base',
      description: 'Synthetic knowledge base for the local MCP fixture.',
      knowledgeGraphEnabled: false,
      deletedAt: null,
    },
  })

  await tx.kBChatbot.create({
    data: {
      id: LOCAL_KB_CHATBOT_ID,
      kbId: LOCAL_KB_ID,
      chatbotId: LOCAL_CHATBOT_ID,
      isEnabled: true,
    },
  })
}

async function createMcpFixture(tx, token) {
  const server = buildServer(token)
  const configurations = buildConfigurations()

  assertLocalSeedOwnership(server, configurations, {
    id: LOCAL_CHATBOT_ID,
    ownerId: LOCAL_OWNER_ID,
    courseId: LOCAL_COURSE_ID,
  })

  await tx.chatbotMCPServer.create({ data: server })
  for (const configuration of configurations) {
    await tx.chatbotMCPConfig.create({
      data: configuration,
    })
  }
}

async function createBudgetsAndCredits(tx) {
  const monthStart = getZurichMonthStart(new Date())

  await tx.chatAccountUsage.createMany({
    data: [
      {
        ownerId: LOCAL_OWNER_ID,
        usageClass: 'BASE',
        monthStart,
        budgetCredits: LOCAL_USAGE_BUDGET,
        usedCredits: 0,
      },
      {
        ownerId: LOCAL_OWNER_ID,
        usageClass: 'ADVANCED',
        monthStart,
        budgetCredits: LOCAL_USAGE_BUDGET,
        usedCredits: 0,
      },
    ],
  })

  await tx.chatUsageCredits.create({
    data: {
      participantId: LOCAL_PARTICIPANT_ID,
      chatbotId: LOCAL_CHATBOT_ID,
      total: LOCAL_CREDIT_BALANCE,
      current: LOCAL_CREDIT_BALANCE,
      periodStartedAt: new Date(),
      lastResetAt: new Date(),
      resetCount: 0,
    },
  })
}

async function createLocalDomain(tx, token, interrupted, passwords) {
  assertNotInterrupted(interrupted)
  await createOwner(tx, passwords.owner)
  assertNotInterrupted(interrupted)
  await createCourse(tx)
  await createParticipant(tx, passwords.participant)
  assertNotInterrupted(interrupted)
  await createChatbot(tx)
  await createKnowledgeBase(tx)
  assertNotInterrupted(interrupted)
  await createMcpFixture(tx, token)
  await createBudgetsAndCredits(tx)
  assertNotInterrupted(interrupted)
}

async function rotateServerSecret(tx, token, interrupted) {
  assertNotInterrupted(interrupted)
  await tx.chatbotMCPServer.update({
    where: { id: LOCAL_SERVER_ID },
    data: { authSecret: encrypt(token) },
  })
  assertNotInterrupted(interrupted)
}

// The caller owns the local-runtime boundary and the guarded Prisma client.
export async function repairLocalMcpSeed(
  db,
  token,
  isInterrupted = () => false
) {
  const interrupted =
    typeof isInterrupted === 'function' ? isInterrupted : () => false

  try {
    await requireDisposableDatabase(db)
    if (typeof token !== 'string' || token.length === 0) {
      throw new Error('Local MCP seed token missing')
    }

    const passwords = {
      owner: await bcrypt.hash('abcd', 12),
      participant: await bcrypt.hash('abcdabcd', 12),
    }

    await db.$transaction(
      async (tx) => {
        const state = await readDomainState(tx)

        if (
          state.servers.length > 1 ||
          hasNameCollision(
            state.servers.find((server) => server.id === LOCAL_SERVER_ID),
            state.servers.filter((server) => server.name === LOCAL_SERVER_NAME)
          )
        ) {
          throw new Error('Local MCP seed collision')
        }

        if (hasUnexpectedChatbotConsumer(state.configurations)) {
          throw new Error('Local MCP consumer conflict')
        }

        if (isEmptyDomain(state)) {
          await createLocalDomain(tx, token, interrupted, passwords)
          return
        }

        if (!isCompleteDomain(state)) {
          throw new Error('Local MCP seed ownership conflict')
        }

        await rotateServerSecret(tx, token, interrupted)
      },
      {
        isolationLevel: 'Serializable',
        maxWait: 5000,
        timeout: 10000,
      }
    )
  } catch {
    throw new Error('Local MCP seed repair rejected')
  }
}
