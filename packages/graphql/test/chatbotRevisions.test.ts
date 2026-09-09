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
    const draft = await seed(ChatbotStatus.DRAFT)
    await expect(
      service.saveChatbotRevision(
        {
          chatbotId: draft.id,
          expectedRevisionVersion: undefined as unknown as number,
          input,
        },
        owner
      )
    ).rejects.toMatchObject({ extensions: { code: 'CHATBOT_EDIT_CONFLICT' } })
  })

  it('stages legacy tokened writes and approves only the submitted version', async () => {
    const bot = await seed()
    await expect(
      service.updateChatbot({ id: bot.id, name: 'Unfenced' }, owner)
    ).rejects.toMatchObject({ extensions: { code: 'CHATBOT_EDIT_CONFLICT' } })
    await service.updateChatbot(
      { id: bot.id, name: 'Revised', expectedRevisionVersion: 0 },
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
      service.approveChatbotPublication({ id: bot.id }, admin)
    ).rejects.toMatchObject({ extensions: { code: 'CHATBOT_EDIT_CONFLICT' } })
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

  it('stages every legacy configuration save until exact-version approval', async () => {
    const bot = await seed()
    const writes = [
      (version: number | undefined) =>
        service.updateChatbotModelSettings(
          {
            chatbotId: bot.id,
            expectedRevisionVersion: version,
            modelSelection: false,
            allowedModelIds: ['auto'],
          },
          owner
        ),
      (version: number | undefined) =>
        service.updateChatbotModelPolicy(
          {
            chatbotId: bot.id,
            expectedRevisionVersion: version,
            modelSelection: false,
            allowedModelIds: ['auto'],
          },
          owner
        ),
      (version: number | undefined) =>
        service.updateChatbotStandardModeConfig(
          {
            chatbotId: bot.id,
            expectedRevisionVersion: version,
            config: {
              tutorEnabled: true,
              explainerEnabled: false,
              quizzerEnabled: true,
              courseName: 'Synthetic course',
              subjectDomain: 'Synthetic subject',
              languageOfInstruction: 'en',
              scopeNote: 'Synthetic scope',
            },
          },
          owner
        ),
      (version: number | undefined) =>
        service.updateChatbotCreditPolicy(
          {
            chatbotId: bot.id,
            expectedRevisionVersion: version,
            creditInitialCredits: 25,
            creditResetAmount: 15,
            creditMaxCredits: 50,
            creditResetPeriod: CreditResetPeriod.DAILY,
          },
          owner
        ),
    ]
    for (const [version, write] of writes.entries()) {
      await expect(write(undefined)).rejects.toMatchObject({
        extensions: { code: 'CHATBOT_EDIT_CONFLICT' },
      })
      await write(version)
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
    await submit(bot.id, 4)
    await service.approveChatbotRevision(
      { id: bot.id, expectedRevisionVersion: 5 },
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
        service.updateChatbot(
          { id: bot.id, name, expectedRevisionVersion: 0 },
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
      service.updateChatbot(
        { id: bot.id, name: 'Late', expectedRevisionVersion: 2 },
        owner
      )
    ).rejects.toMatchObject({ extensions: { code: 'CHATBOT_NOT_EDITABLE' } })
  })

  it('allows only one approval or withdrawal of the submitted version', async () => {
    const bot = await seed()
    await service.updateChatbotRevisionMetadata(
      {
        chatbotId: bot.id,
        name: 'Concurrent revision',
        expectedRevisionVersion: 0,
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

  it('preserves first-publication preview and fences tokenless legacy saves', async () => {
    const bot = await seed(ChatbotStatus.DRAFT)
    await service.updateChatbot({ id: bot.id, name: 'Legacy first' }, owner)
    await service.updateChatbot(
      { id: bot.id, description: 'Legacy second' },
      owner
    )
    expect(await read(bot.id)).toMatchObject({
      name: 'Legacy first',
      description: 'Legacy second',
      revisionVersion: 2,
      draftConfig: null,
    })
    await expect(
      service.updateChatbot(
        { id: bot.id, name: 'Stale', expectedRevisionVersion: 0 },
        owner
      )
    ).rejects.toMatchObject({ extensions: { code: 'CHATBOT_EDIT_CONFLICT' } })
    await service.updateChatbotRevisionMetadata(
      { chatbotId: bot.id, name: 'Preview', expectedRevisionVersion: 2 },
      owner
    )
    expect(await read(bot.id)).toMatchObject({
      name: 'Preview',
      draftConfig: { name: 'Preview' },
    })
    await expect(
      service.updateChatbot({ id: bot.id, name: 'Unfenced' }, owner)
    ).rejects.toMatchObject({ extensions: { code: 'CHATBOT_EDIT_CONFLICT' } })
    await submit(bot.id, 3)
    await service.withdrawChatbotRevision(
      { chatbotId: bot.id, expectedRevisionVersion: 4 },
      owner
    )
    expect(await read(bot.id)).toMatchObject({
      status: ChatbotStatus.DRAFT,
      revisionStatus: ChatbotStatus.DRAFT,
      revisionVersion: 5,
    })
    await submit(bot.id, 5)
    await service.rejectChatbotRevision(
      {
        id: bot.id,
        expectedRevisionVersion: 6,
        comment: 'Synthetic requested revision',
      },
      admin
    )
    expect(await read(bot.id)).toMatchObject({
      status: ChatbotStatus.REJECTED,
      revisionStatus: ChatbotStatus.REJECTED,
      revisionVersion: 7,
    })
    await submit(bot.id, 7)
    await expect(
      service.approveChatbotRevision(
        { id: bot.id, expectedRevisionVersion: 6 },
        admin
      )
    ).rejects.toMatchObject({ extensions: { code: 'CHATBOT_EDIT_CONFLICT' } })
  })

  it('uses the revision version for sequential disclaimer saves', async () => {
    const bot = await seed()

    await service.saveChatbotDisclaimer(
      {
        chatbotId: bot.id,
        expectedRevisionVersion: bot.revisionVersion,
        title: 'First replacement',
        introText: 'First replacement introduction.',
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

    await service.saveChatbotDisclaimer(
      {
        chatbotId: bot.id,
        expectedRevisionVersion: first.revisionVersion,
        title: 'Second replacement',
        introText: 'Second replacement introduction.',
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
      service.saveChatbotDisclaimer(
        {
          chatbotId: bot.id,
          expectedRevisionVersion: second.revisionVersion,
          expectedDisclaimerId: bot.disclaimerId,
          title: 'Stale replacement',
          introText: 'Stale replacement introduction.',
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
    await service.saveChatbotDisclaimer(
      {
        chatbotId: bot.id,
        expectedRevisionVersion: 0,
        expectedDisclaimerId: bot.disclaimerId,
        title: 'Replacement',
        introText: 'Synthetic replacement.',
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
    await service.updateChatbot(
      { id: bot.id, name: 'Revised', expectedRevisionVersion: 0 },
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
    await service.updateChatbot(
      { id: bot.id, name: 'Revised', expectedRevisionVersion: 0 },
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
})
