import {
  ChatbotStatus,
  CreditResetPeriod,
  UserRole,
} from '@klicker-uzh/prisma/client'
import type { ContextWithUser } from '../src/lib/context.js'
import * as service from '../src/services/chatbots.js'
import {
  initializePrisma,
  seedCourse,
  testCleanup,
  testInitialization,
} from './helpers.js'

describe('chatbot authoring revision transitions', () => {
  let dependencies: Awaited<ReturnType<typeof initializePrisma>>
  let owner: ContextWithUser
  let admin: ContextWithUser

  beforeAll(async () => {
    dependencies = await initializePrisma()
  })
  beforeEach(async () => {
    const contexts = await testInitialization(
      dependencies.prisma,
      dependencies.hatchet,
      dependencies.emitter
    )
    owner = contexts.userOneCtx
    admin = {
      ...contexts.userTwoCtx,
      user: { ...contexts.userTwoCtx.user, role: UserRole.ADMIN },
    }
    await dependencies.prisma.user.update({
      where: { id: owner.user.sub },
      data: { aiFeaturesEnabled: true },
    })
  })
  afterEach(async () => {
    await testCleanup(dependencies.prisma)
  })
  afterAll(async () => {
    await dependencies.prisma.$disconnect()
  })

  async function seed(status: ChatbotStatus = ChatbotStatus.PUBLISHED) {
    const course = await seedCourse({}, owner)
    const disclaimer = await dependencies.prisma.chatbotDisclaimer.create({
      data: {
        name: 'Synthetic revision disclaimer',
        title: 'Synthetic title',
        introText: 'Synthetic introduction.',
        ownerId: owner.user.sub,
      },
    })
    return dependencies.prisma.chatbot.create({
      data: {
        ownerId: owner.user.sub,
        courseId: course.id,
        name: 'Synthetic revision bot',
        status,
        disclaimerId: disclaimer.id,
        publishedAt:
          status === ChatbotStatus.PUBLISHED
            ? new Date('2026-01-01T12:00:00Z')
            : null,
        creditInitialCredits: 10,
        creditResetAmount: 10,
        creditMaxCredits: 100,
      },
    })
  }
  const read = (id: string) =>
    dependencies.prisma.chatbot.findUniqueOrThrow({ where: { id } })
  const submit = (id: string, version: number) =>
    service.submitChatbotRevision(
      {
        chatbotId: id,
        expectedRevisionVersion: version,
        useCase: 'Synthetic course support',
        expectedStudentCount: 20,
      },
      owner
    )

  it('saves multiple typed sections atomically with one version increment', async () => {
    const bot = await seed()
    const saved = await service.saveChatbotRevision(
      {
        chatbotId: bot.id,
        expectedRevisionVersion: 0,
        input: {
          metadata: {
            name: 'Revised together',
            description: 'Synthetic description',
          },
          modelPolicy: { modelSelection: false, allowedModelIds: ['auto'] },
          standardModeConfig: {
            tutorEnabled: true,
            explainerEnabled: false,
            quizzerEnabled: true,
          },
          creditPolicy: {
            creditInitialCredits: 5,
            creditResetPeriod: CreditResetPeriod.DAILY,
            creditResetAmount: 5,
            creditMaxCredits: 5,
          },
          disclaimer: {
            title: 'Replacement title',
            introText: 'Replacement introduction.',
          },
        },
      },
      owner
    )
    expect(saved?.revisionVersion).toBe(1)
    const stored = await read(bot.id)
    expect(stored).toMatchObject({
      name: bot.name,
      disclaimerId: bot.disclaimerId,
      creditInitialCredits: bot.creditInitialCredits,
      revisionVersion: 1,
      draftConfig: {
        name: 'Revised together',
        description: 'Synthetic description',
        modelSelection: false,
        allowedModelIds: ['auto'],
        standardModeConfig: {
          tutorEnabled: true,
          explainerEnabled: false,
          quizzerEnabled: true,
        },
        creditInitialCredits: 5,
        creditResetPeriod: CreditResetPeriod.DAILY,
        creditResetAmount: 5,
        creditMaxCredits: 5,
        disclaimerTitle: 'Replacement title',
      },
    })
    const draft = stored.draftConfig as { disclaimerId: string }
    expect(draft.disclaimerId).not.toBe(bot.disclaimerId)
    await service.saveChatbotRevision(
      {
        chatbotId: bot.id,
        expectedRevisionVersion: 1,
        input: {
          disclaimer: {
            title: 'Replacement title',
            introText: 'Replacement introduction.',
          },
        },
      },
      owner
    )
    expect(await read(bot.id)).toMatchObject({
      revisionVersion: 2,
      draftConfig: { disclaimerId: draft.disclaimerId },
    })
  })

  it('preserves omitted revision sections and distinguishes metadata clearing', async () => {
    const bot = await seed()
    await service.saveChatbotRevision(
      {
        chatbotId: bot.id,
        expectedRevisionVersion: 0,
        input: {
          metadata: {
            description: 'Synthetic description',
            avatar: 'synthetic.svg',
          },
        },
      },
      owner
    )
    const before = await read(bot.id)
    await service.saveChatbotRevision(
      {
        chatbotId: bot.id,
        expectedRevisionVersion: 1,
        input: { metadata: { description: null } },
      },
      owner
    )
    expect((await read(bot.id)).draftConfig).toEqual({
      ...(before.draftConfig as object),
      description: null,
    })
    for (const input of [
      {},
      { metadata: {} },
      { metadata: { name: null } },
      { creditPolicy: null },
      { disclaimer: null },
    ]) {
      await expect(
        service.saveChatbotRevision(
          { chatbotId: bot.id, expectedRevisionVersion: 2, input },
          owner
        )
      ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })
    }
    expect((await read(bot.id)).revisionVersion).toBe(2)
  })

  it('rolls back every section and replacement disclaimer on a failed save', async () => {
    const bot = await seed()
    const count = () =>
      dependencies.prisma.chatbotDisclaimer.count({
        where: { ownerId: owner.user.sub },
      })
    const beforeCount = await count()
    const before = await read(bot.id)
    // The invalid name is rejected after the replacement is created in the transaction.
    await expect(
      service.saveChatbotRevision(
        {
          chatbotId: bot.id,
          expectedRevisionVersion: 0,
          input: {
            metadata: { name: '' },
            disclaimer: {
              title: 'Replacement title',
              introText: 'Replacement introduction.',
            },
          },
        },
        owner
      )
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })
    expect(await read(bot.id)).toEqual(before)
    expect(await count()).toBe(beforeCount)
    await expect(
      service.saveChatbotRevision(
        {
          chatbotId: bot.id,
          expectedRevisionVersion: 0,
          input: {
            metadata: { name: 'Valid name' },
            creditPolicy: {
              creditInitialCredits: -1,
              creditResetPeriod: CreditResetPeriod.DAILY,
              creditResetAmount: 5,
              creditMaxCredits: 5,
            },
          },
        },
        owner
      )
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })
    expect(await read(bot.id)).toEqual(before)
  })

  it('fences unified saves by owner, required version, and pending state', async () => {
    const bot = await seed()
    const input = { metadata: { name: 'Revised together' } }
    expect(
      await service.saveChatbotRevision(
        { chatbotId: bot.id, expectedRevisionVersion: 0, input },
        admin
      )
    ).toBeNull()
    await service.saveChatbotRevision(
      { chatbotId: bot.id, expectedRevisionVersion: 0, input },
      owner
    )
    await expect(
      service.saveChatbotRevision(
        { chatbotId: bot.id, expectedRevisionVersion: 0, input },
        owner
      )
    ).rejects.toMatchObject({ extensions: { code: 'CHATBOT_EDIT_CONFLICT' } })
    await submit(bot.id, 1)
    const pending = await read(bot.id)
    await expect(
      service.saveChatbotRevision(
        {
          chatbotId: bot.id,
          expectedRevisionVersion: pending.revisionVersion,
          input,
        },
        owner
      )
    ).rejects.toMatchObject({ extensions: { code: 'CHATBOT_NOT_EDITABLE' } })
    expect(await read(bot.id)).toEqual(pending)
  })

  it('stages metadata writes and approves only the submitted version', async () => {
    const bot = await seed()
    await expect(
      service.saveChatbotRevision(
        {
          chatbotId: bot.id,
          expectedRevisionVersion: 1,
          input: { metadata: { name: 'Stale' } },
        },
        owner
      )
    ).rejects.toMatchObject({ extensions: { code: 'CHATBOT_EDIT_CONFLICT' } })
    await service.saveChatbotRevision(
      {
        chatbotId: bot.id,
        expectedRevisionVersion: 0,
        input: { metadata: { name: 'Revised' } },
      },
      owner
    )
    expect(await read(bot.id)).toMatchObject({
      name: bot.name,
      revisionVersion: 1,
      draftConfig: { name: 'Revised' },
    })
    await submit(bot.id, 1)
    const pending = await read(bot.id)
    expect(pending.status).toBe(ChatbotStatus.PUBLISHED)
    expect(
      await service.getChatbotPendingRevision({ id: bot.id }, admin)
    ).toMatchObject({ version: pending.revisionVersion, name: 'Revised' })
    await expect(
      service.approveChatbotRevision(
        { id: bot.id, expectedRevisionVersion: 1 },
        admin
      )
    ).rejects.toMatchObject({ extensions: { code: 'CHATBOT_EDIT_CONFLICT' } })
    await service.approveChatbotRevision(
      { id: bot.id, expectedRevisionVersion: pending.revisionVersion },
      admin
    )
    expect(await read(bot.id)).toMatchObject({
      name: 'Revised',
      status: ChatbotStatus.PUBLISHED,
      publishedAt: bot.publishedAt,
      draftConfig: null,
      revisionStatus: null,
    })
  })

  it('stages every configuration section until exact-version approval', async () => {
    const bot = await seed()
    const writes = [
      {
        modelPolicy: { modelSelection: false, allowedModelIds: ['auto'] },
      },
      {
        standardModeConfig: {
          tutorEnabled: true,
          explainerEnabled: false,
          quizzerEnabled: true,
          courseName: 'Synthetic course',
          subjectDomain: 'Synthetic subject',
          languageOfInstruction: 'en' as const,
          scopeNote: 'Synthetic scope',
        },
      },
      {
        creditPolicy: {
          creditInitialCredits: 25,
          creditResetAmount: 15,
          creditMaxCredits: 50,
          creditResetPeriod: CreditResetPeriod.DAILY,
        },
      },
    ]
    for (const [version, input] of writes.entries()) {
      await service.saveChatbotRevision(
        {
          chatbotId: bot.id,
          expectedRevisionVersion: version,
          input,
        },
        owner
      )
      const row = await read(bot.id)
      expect(row).toMatchObject({
        modelSelection: bot.modelSelection,
        allowedModelIds: bot.allowedModelIds,
        standardModeConfig: bot.standardModeConfig,
        creditInitialCredits: bot.creditInitialCredits,
        creditResetAmount: bot.creditResetAmount,
        creditMaxCredits: bot.creditMaxCredits,
        creditResetPeriod: bot.creditResetPeriod,
        revisionVersion: version + 1,
      })
    }
    await submit(bot.id, 3)
    await service.approveChatbotRevision(
      { id: bot.id, expectedRevisionVersion: 4 },
      admin
    )
    expect(await read(bot.id)).toMatchObject({
      modelSelection: false,
      allowedModelIds: ['auto'],
      standardModeConfig: { tutorEnabled: true, explainerEnabled: false },
      creditInitialCredits: 25,
      creditResetAmount: 15,
      creditMaxCredits: 50,
      creditResetPeriod: CreditResetPeriod.DAILY,
      publishedAt: bot.publishedAt,
      draftConfig: null,
    })
  })

  it('serializes competing saves and freezes pending content', async () => {
    const bot = await seed()
    const results = await Promise.allSettled(
      ['First', 'Second'].map((name) =>
        service.saveChatbotRevision(
          {
            chatbotId: bot.id,
            expectedRevisionVersion: 0,
            input: { metadata: { name } },
          },
          owner
        )
      )
    )
    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1)
    expect(
      results.filter((result) => result.status === 'rejected')
    ).toHaveLength(1)
    await submit(bot.id, 1)
    await expect(
      service.saveChatbotRevision(
        {
          chatbotId: bot.id,
          expectedRevisionVersion: 2,
          input: { metadata: { name: 'Late' } },
        },
        owner
      )
    ).rejects.toMatchObject({ extensions: { code: 'CHATBOT_NOT_EDITABLE' } })
  })

  it('allows only one approval or withdrawal of the submitted version', async () => {
    const bot = await seed()
    await service.saveChatbotRevision(
      {
        chatbotId: bot.id,
        expectedRevisionVersion: 0,
        input: { metadata: { name: 'Concurrent revision' } },
      },
      owner
    )
    await submit(bot.id, 1)
    const outcomes = await Promise.allSettled([
      service.approveChatbotRevision(
        { id: bot.id, expectedRevisionVersion: 2 },
        admin
      ),
      service.withdrawChatbotRevision(
        { chatbotId: bot.id, expectedRevisionVersion: 2 },
        owner
      ),
    ])
    expect(
      outcomes.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1)
    expect(
      outcomes.filter((result) => result.status === 'rejected')
    ).toHaveLength(1)
    const row = await read(bot.id)
    expect(row).toMatchObject({
      status: ChatbotStatus.PUBLISHED,
      revisionVersion: 3,
    })
    if (outcomes[0]?.status === 'fulfilled') {
      expect(row).toMatchObject({
        name: 'Concurrent revision',
        draftConfig: null,
      })
    } else {
      expect(row).toMatchObject({
        name: bot.name,
        draftConfig: { name: 'Concurrent revision' },
        revisionStatus: ChatbotStatus.DRAFT,
      })
    }
  })

  it('uses the revision version for sequential disclaimer saves', async () => {
    const bot = await seed()

    await service.saveChatbotRevision(
      {
        chatbotId: bot.id,
        expectedRevisionVersion: bot.revisionVersion,
        input: {
          disclaimer: {
            expectedDisclaimerId: bot.disclaimerId,
            title: 'First replacement',
            introText: 'First replacement introduction.',
          },
        },
      },
      owner
    )
    const first = await read(bot.id)
    expect(first).toMatchObject({
      disclaimerId: bot.disclaimerId,
      revisionStatus: ChatbotStatus.DRAFT,
      revisionVersion: 1,
      draftConfig: {
        disclaimerTitle: 'First replacement',
        disclaimerIntroText: 'First replacement introduction.',
      },
    })

    await service.saveChatbotRevision(
      {
        chatbotId: bot.id,
        expectedRevisionVersion: first.revisionVersion,
        input: {
          disclaimer: {
            expectedDisclaimerId: first.draftConfig?.disclaimerId as string,
            title: 'Second replacement',
            introText: 'Second replacement introduction.',
          },
        },
      },
      owner
    )
    const second = await read(bot.id)
    expect(second).toMatchObject({
      disclaimerId: bot.disclaimerId,
      revisionStatus: ChatbotStatus.DRAFT,
      revisionVersion: 2,
      draftConfig: {
        disclaimerTitle: 'Second replacement',
        disclaimerIntroText: 'Second replacement introduction.',
      },
    })
    expect(second.draftConfig?.disclaimerId).not.toBe(bot.disclaimerId)

    await expect(
      service.saveChatbotRevision(
        {
          chatbotId: bot.id,
          expectedRevisionVersion: second.revisionVersion,
          input: {
            disclaimer: {
              expectedDisclaimerId: bot.disclaimerId,
              title: 'Stale replacement',
              introText: 'Stale replacement introduction.',
            },
          },
        },
        owner
      )
    ).rejects.toMatchObject({
      extensions: { code: 'CHATBOT_DISCLAIMER_CONFLICT' },
    })
    expect(await read(bot.id)).toMatchObject({
      disclaimerId: bot.disclaimerId,
      revisionVersion: 2,
      draftConfig: { disclaimerTitle: 'Second replacement' },
    })
  })

  it('leaves a changed disclaimer unlinked until approval', async () => {
    const bot = await seed()
    await service.saveChatbotRevision(
      {
        chatbotId: bot.id,
        expectedRevisionVersion: 0,
        input: {
          disclaimer: {
            expectedDisclaimerId: bot.disclaimerId,
            title: 'Replacement',
            introText: 'Synthetic replacement.',
          },
        },
      },
      owner
    )
    const staged = await read(bot.id)
    expect(staged.disclaimerId).toBe(bot.disclaimerId)
    expect(staged.draftConfig?.disclaimerId).not.toBe(bot.disclaimerId)
    await submit(bot.id, 1)
    await service.approveChatbotRevision(
      { id: bot.id, expectedRevisionVersion: 2 },
      admin
    )
    expect((await read(bot.id)).disclaimerId).toBe(
      staged.draftConfig?.disclaimerId
    )
    expect(
      await dependencies.prisma.chatbotDisclaimer.findUnique({
        where: { id: bot.disclaimerId! },
      })
    ).not.toBeNull()
  })

  it('blocks paused approval and requires an administrator with live publishing capability', async () => {
    const bot = await seed()
    await service.saveChatbotRevision(
      {
        chatbotId: bot.id,
        expectedRevisionVersion: 0,
        input: { metadata: { name: 'Revised' } },
      },
      owner
    )
    await submit(bot.id, 1)
    await expect(
      service.approveChatbotRevision(
        { id: bot.id, expectedRevisionVersion: 2 },
        owner
      )
    ).rejects.toThrow('Not authorized')
    await dependencies.prisma.user.update({
      where: { id: owner.user.sub },
      data: { aiFeaturesEnabled: false },
    })
    await expect(
      service.approveChatbotRevision(
        { id: bot.id, expectedRevisionVersion: 2 },
        admin
      )
    ).rejects.toMatchObject({
      extensions: { code: 'CHATBOT_PUBLISHING_NOT_AUTHORIZED' },
    })
    await dependencies.prisma.user.update({
      where: { id: owner.user.sub },
      data: { aiFeaturesEnabled: true },
    })
    await dependencies.prisma.chatbot.update({
      where: { id: bot.id },
      data: { status: ChatbotStatus.PAUSED },
    })
    await expect(
      service.approveChatbotRevision(
        { id: bot.id, expectedRevisionVersion: 2 },
        admin
      )
    ).rejects.toMatchObject({ extensions: { code: 'CHATBOT_NOT_EDITABLE' } })
    expect((await read(bot.id)).status).toBe(ChatbotStatus.PAUSED)
  })

  it('blocks withdrawal when the ai-beta flag is revoked', async () => {
    const bot = await seed()
    await service.saveChatbotRevision(
      {
        chatbotId: bot.id,
        expectedRevisionVersion: 0,
        input: { metadata: { name: 'Revised' } },
      },
      owner
    )
    await submit(bot.id, 1)

    const revokedOwner: ContextWithUser = {
      ...owner,
      featureFlags: {
        ...owner.featureFlags,
        isEnabled: () => false,
      } as NonNullable<ContextWithUser['featureFlags']>,
    }

    await expect(
      service.withdrawChatbotRevision(
        { chatbotId: bot.id, expectedRevisionVersion: 2 },
        revokedOwner
      )
    ).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } })
    expect(await read(bot.id)).toMatchObject({
      status: ChatbotStatus.PUBLISHED,
      revisionStatus: ChatbotStatus.PENDING_APPROVAL,
      revisionVersion: 2,
    })
  })

  it('stages the knowledge-graph policy until approval', async () => {
    const bot = await seed()
    const saved = await service.saveChatbotRevision(
      {
        chatbotId: bot.id,
        expectedRevisionVersion: 0,
        input: {
          knowledgeGraphPolicy: { visible: true, retrievalEnabled: true },
        },
      },
      owner
    )
    expect(saved?.authoringRevision).toMatchObject({
      knowledgeGraphVisible: true,
      knowledgeGraphRetrievalEnabled: true,
    })
    // A published chatbot keeps serving its live columns until the revision is
    // approved, while the saved revision already carries the new policy.
    expect(await read(bot.id)).toMatchObject({
      knowledgeGraphVisible: bot.knowledgeGraphVisible,
      knowledgeGraphRetrievalEnabled: bot.knowledgeGraphRetrievalEnabled,
      draftConfig: {
        knowledgeGraphVisible: true,
        knowledgeGraphRetrievalEnabled: true,
      },
    })

    await submit(bot.id, 1)
    await service.approveChatbotRevision(
      { id: bot.id, expectedRevisionVersion: 2 },
      admin
    )
    expect(await read(bot.id)).toMatchObject({
      knowledgeGraphVisible: true,
      knowledgeGraphRetrievalEnabled: true,
      draftConfig: null,
    })
  })

  it('inherits the live knowledge-graph flags for a revision that predates them', async () => {
    const bot = await seed()
    await dependencies.prisma.chatbot.update({
      where: { id: bot.id },
      data: {
        knowledgeGraphVisible: true,
        knowledgeGraphRetrievalEnabled: true,
        revisionStatus: ChatbotStatus.DRAFT,
        revisionVersion: 1,
        // @ts-expect-error Persist the legacy shape to exercise compatibility.
        draftConfig: {
          name: 'Legacy revision',
          description: null,
          avatar: null,
          standardModeConfig: null,
          modelSelection: false,
          allowedModelIds: ['auto'],
          allowedReasoningEffortsByModel: null,
          creditInitialCredits: 10,
          creditResetPeriod: CreditResetPeriod.WEEKLY,
          creditResetAmount: 10,
          creditMaxCredits: 100,
          disclaimerTitle: 'Synthetic title',
          disclaimerIntroText: 'Synthetic introduction.',
          publicationUseCase: 'Synthetic course support',
          expectedStudentCount: 20,
        },
      },
    })

    const saved = await service.saveChatbotRevision(
      {
        chatbotId: bot.id,
        expectedRevisionVersion: 1,
        input: { metadata: { description: 'Updated' } },
      },
      owner
    )
    expect(saved?.authoringRevision).toMatchObject({
      knowledgeGraphVisible: true,
      knowledgeGraphRetrievalEnabled: true,
    })
    const inherited = (await read(bot.id)).draftConfig as {
      knowledgeGraphRetrievalEnabled: boolean
    }
    expect(inherited.knowledgeGraphRetrievalEnabled).toBe(true)
  })

  it('rejects a non-boolean knowledge-graph policy value', async () => {
    const bot = await seed()
    await expect(
      service.saveChatbotRevision(
        {
          chatbotId: bot.id,
          expectedRevisionVersion: 0,
          input: {
            knowledgeGraphPolicy: {
              visible: 'yes',
              retrievalEnabled: false,
            } as never,
          },
        },
        owner
      )
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })
    expect((await read(bot.id)).revisionVersion).toBe(0)
  })

  it('rejects a stored revision whose knowledge-graph flag is not a boolean', async () => {
    const bot = await seed()
    await service.saveChatbotRevision(
      {
        chatbotId: bot.id,
        expectedRevisionVersion: 0,
        input: { metadata: { description: 'Staged' } },
      },
      owner
    )
    const staged = await read(bot.id)
    await dependencies.prisma.chatbot.update({
      where: { id: bot.id },
      data: {
        draftConfig: {
          ...(staged.draftConfig as object),
          // @ts-expect-error Persist malformed data to exercise runtime validation.
          knowledgeGraphVisible: 'yes',
        },
      },
    })
    await expect(
      service.saveChatbotRevision(
        {
          chatbotId: bot.id,
          expectedRevisionVersion: staged.revisionVersion,
          input: { metadata: { description: 'Next' } },
        },
        owner
      )
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })
  })
})
