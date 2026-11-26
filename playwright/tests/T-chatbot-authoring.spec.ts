import { expect, type Page, type TestInfo } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { Prisma } from '@klicker-uzh/prisma/client'
import { getPrisma } from '../global-setup.js'
import {
  clearChatCookies,
  getEnrolledParticipantId,
  mockChatStream,
  setParticipantToken,
} from '../util/chat.js'
import { test } from '../util/fixtures.js'
import { selectOption } from '../util/fixtures/activities.js'
import { fillEditorField } from '../util/fixtures/elements.js'
import { mockGrowthBookFeatureFlags } from '../util/fixtures/manage.js'
import { enMessages } from '../util/messages.js'
import {
  COURSE_ID_TEST,
  URL_CHAT,
  URL_MANAGE,
  USER_ID_TEST,
} from '../util/constants.js'

const CHATBOT_PREFIX = 'E2E Authoring'
const FIRST_CHATBOT = `${CHATBOT_PREFIX} One`
const SECOND_CHATBOT = `${CHATBOT_PREFIX} Two`
type StandardModeSelection = {
  tutorEnabled: boolean
  explainerEnabled: boolean
  quizzerEnabled: boolean
  writingCoachEnabled: boolean
}

const STANDARD_MODE_FIELDS = [
  ['tutor', 'tutorEnabled'],
  ['explainer', 'explainerEnabled'],
  ['quizzer', 'quizzerEnabled'],
  ['writing-coach', 'writingCoachEnabled'],
] as const satisfies ReadonlyArray<
  readonly [string, keyof StandardModeSelection]
>
type PublicationChatbotStatus =
  | 'DRAFT'
  | 'REJECTED'
  | 'PENDING_APPROVAL'
  | 'PAUSED'
  | 'PUBLISHED'

function createRequestGate() {
  let releaseGate: (() => void) | undefined
  const wait = new Promise<void>((resolve) => {
    releaseGate = resolve
  })

  return {
    wait,
    release: () => releaseGate?.(),
  }
}

async function cleanupAuthoringChatbots() {
  const prisma = await getPrisma()
  const chatbots = await prisma.chatbot.findMany({
    where: { name: { startsWith: CHATBOT_PREFIX } },
    select: { id: true },
  })

  if (chatbots.length > 0) {
    await prisma.chatbot.deleteMany({
      where: { id: { in: chatbots.map((chatbot) => chatbot.id) } },
    })
  }

  await prisma.kB.deleteMany({
    where: {
      ownerId: USER_ID_TEST,
      name: {
        in: [`${CHATBOT_PREFIX} Casebook`, `${CHATBOT_PREFIX} Question bank`],
      },
    },
  })

  await prisma.chatbotDisclaimer.deleteMany({
    where: { name: { startsWith: CHATBOT_PREFIX } },
  })

  // Chatbot authoring requires the AI approval; tests that exercise a
  // missing approval switch it off themselves.
  await prisma.user.update({
    where: { id: USER_ID_TEST },
    data: { aiFeaturesEnabled: true },
  })
}

async function createChatbot(
  page: Parameters<typeof fillEditorField>[0],
  name: string
) {
  await page.getByTestId('create-chatbot').click()
  await page.getByTestId('create-chatbot-name').fill(name)
  await page
    .getByTestId('create-chatbot-description')
    .fill(`${name} description`)
  await selectOption(page, '[data-cy="create-chatbot-course"]', 'Testkurs')
  await page.getByTestId('submit-create-chatbot').click()
  await expect(page.getByTestId(`chatbot-${name}`)).toBeVisible()
  // A new chatbot continues into its materials section and already has
  // suggested student information. Tests that edit it open its section.
  await expect(page.getByTestId('chatbot-draft-setup')).toBeVisible()
  await expect(
    page.getByTestId('chatbot-section-materials-toggle')
  ).toHaveAttribute('aria-expanded', 'true')
  await openSection(page, 'students')
  await expect(page.getByTestId('chatbot-disclaimer-title')).not.toHaveValue('')
  await expect(page.getByTestId('chatbot-section-students')).toHaveAttribute(
    'data-status',
    'suggested'
  )

  const chatbotId = new URL(page.url()).searchParams.get('chatbotId')
  expect(chatbotId).toBeTruthy()
  return chatbotId as string
}

type SectionId =
  | 'materials'
  | 'students'
  | 'modes'
  | 'model'
  | 'usage'
  | 'graph'

// Opens a section of the draft setup page unless it is already open.
async function openSection(page: Page, id: SectionId) {
  const toggle = page.getByTestId(`chatbot-section-${id}-toggle`)
  await expect(toggle).toBeVisible()
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click()
  }
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
}

// A successful save closes the section.
async function saveSection(page: Page, id: SectionId) {
  await expect(page.getByTestId(`chatbot-section-${id}-save`)).toBeEnabled()
  await page.getByTestId(`chatbot-section-${id}-save`).click()
  await expect(
    page.getByTestId(`chatbot-section-${id}-toggle`)
  ).toHaveAttribute('aria-expanded', 'false')
}

// Opens a setup section of a draft or rejected chatbot through its link.
async function navigateToSetupStep(
  page: Page,
  step: 'basics' | 'modes' | 'disclaimer' | 'credits' | 'review'
) {
  const url = new URL(page.url())
  if (step === 'modes') {
    url.searchParams.set('view', 'behavior')
    url.searchParams.delete('step')
  } else if (step === 'credits') {
    url.searchParams.set('view', 'usage')
    url.searchParams.delete('step')
  } else if (step === 'disclaimer') {
    url.searchParams.set('view', 'disclaimer')
    url.searchParams.delete('step')
  } else {
    url.searchParams.set('view', 'overview')
    url.searchParams.set('step', step)
  }
  await page.goto(url.toString())
  if (step === 'basics') {
    await expect(page.getByTestId('chatbot-edit-details-modal')).toBeVisible()
    await expect(page.getByTestId('chatbot-name')).toBeVisible()
  } else if (step === 'review') {
    await expect(page.getByTestId('chatbot-section-request')).toBeVisible()
    await expect(page.getByTestId('chatbot-setup-review')).toBeVisible()
  } else {
    const section = {
      modes: 'modes',
      disclaimer: 'students',
      credits: 'usage',
    }[step] as SectionId
    await expect(
      page.getByTestId(`chatbot-section-${section}-toggle`)
    ).toHaveAttribute('aria-expanded', 'true')
  }
}

// Every chatbot status is one page of collapsible sections.
async function expectSetupTriggers(page: Page) {
  await expect(page.getByTestId('chatbot-draft-setup')).toBeVisible()
  for (const section of [
    'materials',
    'students',
    'modes',
    'model',
    'usage',
    'graph',
  ]) {
    await expect(
      page.getByTestId(`chatbot-section-${section}-toggle`)
    ).toBeVisible()
  }
}

async function setPublishingAuthorization(enabled: boolean) {
  const prisma = await getPrisma()
  await prisma.user.update({
    where: { id: USER_ID_TEST },
    data: { aiFeaturesEnabled: enabled },
  })
}

async function seedPublicationChatbot({
  name,
  status,
  withDisclaimer,
  incompleteDisclaimer,
  reviewComment,
}: {
  name: string
  status: PublicationChatbotStatus
  withDisclaimer: boolean
  incompleteDisclaimer?: boolean
  reviewComment?: string
}) {
  const prisma = await getPrisma()
  const disclaimer = withDisclaimer
    ? await prisma.chatbotDisclaimer.create({
        data: {
          name: `${name} disclaimer`,
          title:
            incompleteDisclaimer === true
              ? '   '
              : 'Synthetic chatbot disclaimer',
          introText:
            incompleteDisclaimer === true
              ? ''
              : 'Synthetic disclaimer text for this test chatbot.',
          ownerId: USER_ID_TEST,
        },
      })
    : undefined

  return prisma.chatbot.create({
    data: {
      name,
      description: `${name} description`,
      ownerId: USER_ID_TEST,
      courseId: COURSE_ID_TEST,
      status,
      publishedAt:
        status === 'PUBLISHED' || status === 'PAUSED'
          ? new Date('2026-01-01T12:00:00Z')
          : undefined,
      disclaimerId: disclaimer?.id,
      publicationUseCase:
        status === 'DRAFT' ? undefined : 'Initial synthetic use case',
      expectedStudentCount: status === 'DRAFT' ? undefined : 20,
      creditInitialCredits: 10,
      creditResetPeriod: 'WEEKLY',
      creditResetAmount: 10,
      creditMaxCredits: 100,
      reviewComment,
    },
  })
}

async function approveRevision(page: Page, id: string, version: number) {
  const review = await page.context().newPage()
  try {
    await review.goto(`${process.env.URL_MANAGE ?? URL_MANAGE}/admin`)
    await review.getByTestId(`open-chatbot-review-${id}`).click()
    await review.getByTestId(`approve-chatbot-${id}`).click()
    const prisma = await getPrisma()
    await expect
      .poll(() =>
        prisma.chatbot.findUnique({
          where: { id },
          select: { status: true, revisionVersion: true, revisionStatus: true },
        })
      )
      .toEqual({
        status: 'PUBLISHED',
        revisionVersion: version + 1,
        revisionStatus: null,
      })
  } finally {
    await review.close()
  }
}

async function fillPublicationRequest(page: Page, useCase: string) {
  await page.getByTestId('chatbot-publication-use-case').fill(useCase)
  await page
    .getByTestId('chatbot-publication-expected-student-count')
    .fill('40')
}

async function setStandardModes(page: Page, selection: StandardModeSelection) {
  for (const [mode, field] of STANDARD_MODE_FIELDS) {
    const toggle = page.getByTestId(`chatbot-mode-switch-${mode}`)
    await expect(toggle).toBeEnabled()
    if ((await toggle.isChecked()) !== selection[field]) {
      await toggle.click()
    }
    if (selection[field]) {
      await expect(toggle).toBeChecked()
    } else {
      await expect(toggle).not.toBeChecked()
    }
  }
}

async function expectStandardModes(
  page: Page,
  selection: StandardModeSelection
) {
  for (const [mode, field] of STANDARD_MODE_FIELDS) {
    const toggle = page.getByTestId(`chatbot-mode-switch-${mode}`)
    await expect(toggle).toBeEnabled()
    if (selection[field]) {
      await expect(toggle).toBeChecked()
    } else {
      await expect(toggle).not.toBeChecked()
    }
  }
}

async function submitChatbotRevision(page: Page, useCase: string) {
  await navigateToSetupStep(page, 'review')
  await fillPublicationRequest(page, useCase)
  const submit = page.getByTestId('request-chatbot-publication')
  await expect(submit).toBeEnabled()
  await submit.click()
  await expect(
    page.getByTestId('chatbot-details').getByTestId('chatbot-status')
  ).toHaveText('Pending approval')
}

async function openOwnerPreview(page: Page, chatbotId: string) {
  const [preview] = await Promise.all([
    page.context().waitForEvent('page', { timeout: 30_000 }),
    page.getByTestId('chatbot-owner-preview-link').click(),
  ])
  await expect(preview).toHaveURL(
    `${process.env.URL_CHAT ?? URL_CHAT}/preview/${chatbotId}`
  )
  await expect(preview.getByTestId('chat-composer')).toBeVisible()
  await expect(preview.getByTestId('chat-error')).toHaveCount(0)
  return preview
}

async function mockPreviewChatStream(
  page: Page,
  chatbotId: string,
  text: string
) {
  let counter = 0
  await page.route(
    `**/api/manage/chatbots/${chatbotId}/preview/chat`,
    (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      counter += 1
      const textId = `preview-text-${counter}`
      return route.fulfill({
        body:
          [
            'data: {"type":"start"}',
            'data: {"type":"start-step"}',
            `data: {"type":"text-start","id":"${textId}"}`,
            `data: {"type":"text-delta","id":"${textId}","delta":${JSON.stringify(text)}}`,
            `data: {"type":"text-end","id":"${textId}"}`,
            'data: {"type":"finish-step"}',
            'data: {"type":"finish"}',
            'data: [DONE]',
          ].join('\n\n') + '\n\n',
        headers: {
          'content-type': 'text/event-stream',
          'x-vercel-ai-ui-message-stream': 'v1',
        },
        status: 200,
      })
    }
  )
}

async function visitParticipantChat(page: Page, chatbotId: string) {
  await clearChatCookies(page)
  await setParticipantToken(page, await getEnrolledParticipantId())
  await page.goto(`${process.env.URL_CHAT ?? URL_CHAT}/${chatbotId}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.getByTestId('chat-disclaimer-accept').click()
  await expect(page.getByTestId('chat-disclaimer-content')).toHaveCount(0)
  await expect(page.getByTestId('chat-composer')).toBeVisible()
}

async function sendChatMessage(page: Page, text: string) {
  await page.getByTestId('chat-composer-input').fill(text)
  await page.getByTestId('chat-send-button').click()
}

async function attachScreenshot(testInfo: TestInfo, page: Page, name: string) {
  const path = testInfo.outputPath(`${name}.png`)
  await page.screenshot({ path, animations: 'disabled' })
  await testInfo.attach(name, { path, contentType: 'image/png' })
}

async function expectNoModeSelection(page: Page) {
  await expect(page.getByTestId('chat-mode-switcher')).toHaveCount(0)
  await expect(page.getByTestId('chat-welcome-mode-switcher')).toHaveCount(0)
  await expect(
    page.getByTestId('chat-embedded-toolbar').getByRole('combobox', {
      name: enMessages.chat.modes.switcherLabel,
    })
  ).toHaveCount(0)
}

type ChatTurn = {
  prompt: string
  reply: string
}

type PreviewJourney = {
  chatbotId: string
  selectedMode: string
  welcomeTestId: string
  welcomeText: string
  turn: ChatTurn
  screenshotName: string
}

async function exerciseOwnerPreview(
  page: Page,
  testInfo: TestInfo,
  journey: PreviewJourney
) {
  const preview = await openOwnerPreview(page, journey.chatbotId)
  try {
    await expectNoModeSelection(preview)
    await expect(preview.getByTestId(journey.welcomeTestId)).toContainText(
      journey.welcomeText
    )
    await mockPreviewChatStream(preview, journey.chatbotId, journey.turn.reply)
    const request = preview.waitForRequest(
      (candidate) =>
        candidate.method() === 'POST' &&
        candidate
          .url()
          .includes(`/api/manage/chatbots/${journey.chatbotId}/preview/chat`)
    )
    await sendChatMessage(preview, journey.turn.prompt)
    expect((await request).postDataJSON()).toMatchObject({
      selectedMode: journey.selectedMode,
    })
    await expect(
      preview.getByTestId('chat-assistant-message-content')
    ).toContainText(journey.turn.reply)
    await attachScreenshot(testInfo, preview, journey.screenshotName)
  } finally {
    await preview.close()
  }
}

type ParticipantJourney = {
  chatbotId: string
  selectedMode: string
  welcomeTestId: string
  welcomeText: string
  standaloneTurns: readonly ChatTurn[]
  embeddedTurn: ChatTurn
  screenshotName: string
}

async function sendChatTurn(
  page: Page,
  chatbotId: string,
  selectedMode: string,
  turn: ChatTurn
) {
  const request = page.waitForRequest(
    (candidate) =>
      candidate.method() === 'POST' &&
      candidate.url().endsWith(`/api/chatbots/${chatbotId}/chat`)
  )
  await sendChatMessage(page, turn.prompt)
  expect((await request).postDataJSON()).toMatchObject({ selectedMode })
  await expect(
    page.getByTestId('chat-assistant-message-content').last()
  ).toContainText(turn.reply)
}

async function exerciseParticipantJourney(
  page: Page,
  testInfo: TestInfo,
  journey: ParticipantJourney
) {
  const participant = await page.context().newPage()
  try {
    await mockChatStream(
      participant,
      {
        textByCall: [...journey.standaloneTurns, journey.embeddedTurn].map(
          (turn) => turn.reply
        ),
      },
      journey.chatbotId
    )
    await visitParticipantChat(participant, journey.chatbotId)
    await expectNoModeSelection(participant)
    await expect(participant.getByTestId(journey.welcomeTestId)).toContainText(
      journey.welcomeText
    )

    for (const turn of journey.standaloneTurns) {
      await sendChatTurn(
        participant,
        journey.chatbotId,
        journey.selectedMode,
        turn
      )
    }
    await attachScreenshot(
      testInfo,
      participant,
      `${journey.screenshotName}-standalone`
    )

    await participant.goto(
      `${process.env.URL_CHAT ?? URL_CHAT}/${journey.chatbotId}?embed=true`,
      { waitUntil: 'domcontentloaded' }
    )
    await expect(participant.getByTestId('chat-composer')).toBeVisible()
    await expectNoModeSelection(participant)
    await sendChatTurn(
      participant,
      journey.chatbotId,
      journey.selectedMode,
      journey.embeddedTurn
    )
    await attachScreenshot(
      testInfo,
      participant,
      `${journey.screenshotName}-embedded`
    )
  } finally {
    await participant.close()
  }
}

test('Disabled AI beta blocks the direct authoring route before its queries', async ({
  page,
  loginLecturer,
}) => {
  await mockGrowthBookFeatureFlags(page, { aiBeta: false })
  await loginLecturer()
  const persisted = JSON.parse(
    await readFile(
      new URL('../../packages/graphql/src/public/client.json', import.meta.url),
      'utf8'
    )
  ) as Record<string, string>
  const protectedNames = [
    'QGetChatbotsInfoWithAuthoringRevisions',
    'GetChatModelRegistry',
    'GetChatbotPublishingCapability',
  ]
  const seen: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (!url.pathname.endsWith('/api/graphql')) return
    const body = request.method() === 'POST' ? request.postDataJSON() : null
    const extensions =
      body?.extensions ?? JSON.parse(url.searchParams.get('extensions') ?? '{}')
    const name = body?.operationName ?? url.searchParams.get('operationName')
    const hash = extensions?.persistedQuery?.sha256Hash
    for (const protectedName of protectedNames) {
      if (name === protectedName || (hash && hash === persisted[protectedName]))
        seen.push(protectedName)
    }
  })
  await page.goto(`${process.env.URL_MANAGE ?? URL_MANAGE}/resources/chatbots`)
  await expect(page.getByTestId('chatbot-authoring-unavailable')).toBeVisible()
  await expect(page.getByTestId('create-chatbot')).not.toBeAttached()
  await expect(page.getByTestId('chatbot-beta-settings')).toHaveAttribute(
    'href',
    '/user/settings#beta-features'
  )
  expect(seen).toEqual([])
})

test.describe.serial('Lecturer chatbot draft authoring', () => {
  test.beforeEach(async ({ loginLecturer, page }) => {
    await cleanupAuthoringChatbots()
    await mockGrowthBookFeatureFlags(page, { aiBeta: true })
    await loginLecturer()
    await page.goto(
      `${process.env.URL_MANAGE ?? URL_MANAGE}/resources/chatbots`
    )
    await expect(page.getByTestId('create-chatbot')).toBeVisible()
  })

  test.afterEach(async () => {
    try {
      await cleanupAuthoringChatbots()
    } finally {
      // Other specs share the seeded lecturer and require its original approval.
      await setPublishingAuthorization(true)
    }
  })

  test('requires a cost center for new advanced draft models and retains saved models', async ({
    page,
  }) => {
    const prisma = await getPrisma()
    const previous = await prisma.user.findUniqueOrThrow({
      where: { id: USER_ID_TEST },
      select: { aiSubscriptionTier: true, aiChatbotCostCenter: true },
    })

    try {
      await prisma.user.update({
        where: { id: USER_ID_TEST },
        data: {
          aiSubscriptionTier: 'ADVANCED',
          aiChatbotCostCenter: ' \t\n',
        },
      })
      await page.reload()
      await createChatbot(page, FIRST_CHATBOT)
      await openSection(page, 'model')
      await page.getByTestId('chatbot-model-selection-switch').click()
      await expect(page.getByTestId('chatbot-model-auto')).toBeDisabled()

      await prisma.user.update({
        where: { id: USER_ID_TEST },
        data: { aiChatbotCostCenter: 'SYNTHETIC-COST-CENTER' },
      })
      await page.reload()
      await openSection(page, 'model')
      await page.getByTestId('chatbot-model-selection-switch').click()
      await expect(page.getByTestId('chatbot-model-auto')).toBeEnabled()
      await page.getByTestId('chatbot-model-auto').click()
      const saved = page.waitForResponse(async (response) => {
        if (!response.url().includes('/api/graphql')) return false
        const body = await response.json()
        return Boolean(body.data?.saveChatbotRevision)
      })
      await page.getByTestId('chatbot-section-model-save').click()
      await saved

      await prisma.user.update({
        where: { id: USER_ID_TEST },
        data: { aiChatbotCostCenter: null },
      })
      await page.reload()
      await openSection(page, 'model')
      await expect(page.getByTestId('chatbot-model-auto')).toBeChecked()
      await expect(page.getByTestId('chatbot-model-auto')).toBeEnabled()
    } finally {
      await prisma.user.update({
        where: { id: USER_ID_TEST },
        data: previous,
      })
    }
  })

  test('opens a draft owner preview with its effective modes', async ({
    page,
  }) => {
    const chatbotId = await createChatbot(page, FIRST_CHATBOT)
    await page.context().addInitScript(() => {
      if (!window.location.pathname.startsWith('/preview/')) return
      window.localStorage.setItem(
        'settings-storage',
        '{"state":{"answerStyle":"bullets","answerTone":"direct"},"version":0}'
      )
    })

    const previewPagePromise = page.context().waitForEvent('page')
    await page.getByTestId('chatbot-owner-preview-link').click()
    const previewPage = await previewPagePromise

    await expect(previewPage).toHaveURL(
      `${process.env.URL_CHAT ?? URL_CHAT}/preview/${chatbotId}`
    )
    await expect(previewPage.getByTestId('chat-error')).toHaveCount(0)
    await expect(previewPage.getByTestId('chat-welcome-message')).toBeVisible()
    await expect(previewPage.getByTestId('chat-welcome-mode')).toContainText(
      'Tutor'
    )

    const previewPreferences = await previewPage.evaluate(() => {
      const persisted = JSON.parse(
        window.localStorage.getItem('settings-storage') ?? '{}'
      ) as { state?: Record<string, unknown> }
      return [persisted.state?.answerStyle, persisted.state?.answerTone]
    })
    expect(previewPreferences).toEqual(['bullets', 'direct'])

    await mockPreviewChatStream(previewPage, chatbotId, 'Mocked reply.')

    const previewRequest = previewPage.waitForRequest(
      (request) =>
        request.method() === 'POST' &&
        request.url().includes(`/api/manage/chatbots/${chatbotId}/preview/chat`)
    )
    await previewPage.getByTestId('chat-composer-input').fill('Check prefs')
    await previewPage.getByTestId('chat-send-button').click()

    const previewRequestBody = (await previewRequest).postDataJSON() as {
      answerStyle?: string
      answerTone?: string
    }
    expect({
      answerStyle: previewRequestBody.answerStyle ?? 'balanced',
      answerTone: previewRequestBody.answerTone ?? 'neutral',
    }).toEqual({
      answerStyle: 'balanced',
      answerTone: 'neutral',
    })
  })

  for (const withHistory of [false, true]) {
    test(`clears the owner-preview run announcement after an early stop (${withHistory ? 'with history' : 'empty conversation'})`, async ({
      page,
    }) => {
      const chatbotId = await createChatbot(page, FIRST_CHATBOT)
      const opened = page.context().waitForEvent('page')
      await page.getByTestId('chatbot-owner-preview-link').click()
      const preview = await opened
      await expect(preview.getByTestId('chat-welcome-message')).toBeVisible()
      const requested = createRequestGate()
      const release = createRequestGate()
      let requests = 0
      await preview.route(
        `**/api/manage/chatbots/${chatbotId}/preview/chat`,
        async (route) => {
          requests += 1
          if (requests === (withHistory ? 2 : 1)) {
            requested.release()
            await release.wait
            await route.abort('aborted')
            return
          }
          await route.fulfill({
            status: 200,
            contentType: 'text/event-stream',
            headers: { 'x-vercel-ai-ui-message-stream': 'v1' },
            body: [
              { type: 'start', messageId: `synthetic-${requests}` },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'Synthetic response' },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop' },
            ]
              .map((part) => `data: ${JSON.stringify(part)}\n\n`)
              .join('')
              .concat('data: [DONE]\n\n'),
          })
        }
      )

      const input = preview.getByTestId('chat-composer-input')
      const send = preview.getByTestId('chat-send-button')
      const cancel = preview.getByTestId('chat-cancel-button')
      const status = preview.getByTestId('chat-run-status')
      if (withHistory) {
        await input.fill('Synthetic initial turn')
        await send.click()
        await expect(cancel).toHaveAttribute('aria-hidden', 'true')
        await expect(preview.getByTestId('chat-assistant-message')).toHaveCount(
          1
        )
      }

      try {
        const pendingPrompt = 'Synthetic pending turn'
        await input.fill(pendingPrompt)
        await send.click()
        await requested.wait
        await expect(status).not.toBeEmpty()
        await cancel.click()
        await expect(cancel).toHaveAttribute('aria-hidden', 'true')
        await expect(input).toHaveValue(pendingPrompt)
        await expect(status).toBeEmpty()
      } finally {
        release.release()
      }

      await input.fill('Synthetic recovery turn')
      await send.click()
      await expect(cancel).toHaveAttribute('aria-hidden', 'true')
      await expect(preview.getByTestId('chat-assistant-message')).toHaveCount(
        withHistory ? 2 : 1
      )
      await expect(status).not.toBeEmpty()
      await expect(preview.getByTestId('chat-error')).toHaveCount(0)
      await preview.close()
    })
  }

  test('guards the owner preview while authoring changes are unsaved', async ({
    page,
  }) => {
    const chatbotId = await createChatbot(page, FIRST_CHATBOT)
    await page.getByTestId('chatbot-disclaimer-title').fill('Unsaved title')
    await expect(page.getByTestId('chatbot-disclaimer-title')).toHaveValue(
      'Unsaved title'
    )

    const pagesBeforePreview = page.context().pages().length
    const dialogPromise = page.waitForEvent('dialog')
    const clickPromise = page.getByTestId('chatbot-owner-preview-link').click()
    const dialog = await dialogPromise

    expect(dialog.type()).toBe('confirm')
    await dialog.dismiss()
    await clickPromise
    await expect
      .poll(() => page.context().pages().length)
      .toBe(pagesBeforePreview)

    const previewPagePromise = page.context().waitForEvent('page')
    const secondDialogPromise = page.waitForEvent('dialog')
    const secondClickPromise = page
      .getByTestId('chatbot-owner-preview-link')
      .click()
    const secondDialog = await secondDialogPromise
    expect(secondDialog.type()).toBe('confirm')
    await secondDialog.accept()
    await secondClickPromise

    const previewPage = await previewPagePromise
    await expect(previewPage).toHaveURL(
      `${process.env.URL_CHAT ?? URL_CHAT}/preview/${chatbotId}`
    )

    await page.bringToFront()
    await expect(page.getByTestId('chatbot-disclaimer-title')).toHaveValue(
      'Unsaved title'
    )

    await expect(page.getByTestId('chatbot-section-students')).toHaveAttribute(
      'data-status',
      'unsaved'
    )
    await page.getByTestId('chatbot-section-students-discard').click()
    await expect(page.getByTestId('chatbot-section-students')).toHaveAttribute(
      'data-status',
      'suggested'
    )

    const previewDialogs: string[] = []
    const previewDialogListener = (dialog: {
      type: () => string
      dismiss: () => Promise<void>
    }) => {
      previewDialogs.push(dialog.type())
      void dialog.dismiss()
    }
    page.on('dialog', previewDialogListener)
    const discardedPreviewPagePromise = page.context().waitForEvent('page')
    await page.getByTestId('chatbot-owner-preview-link').click()
    const discardedPreviewPage = await discardedPreviewPagePromise
    page.off('dialog', previewDialogListener)
    expect(previewDialogs).toEqual([])
    await expect(discardedPreviewPage).toHaveURL(
      `${process.env.URL_CHAT ?? URL_CHAT}/preview/${chatbotId}`
    )
  })

  test('locks chatbot creation fields while the request is pending', async ({
    page,
  }) => {
    const createMutationGate = createRequestGate()
    let createOperationCount = 0

    await page.route('**/api/graphql', async (route) => {
      const request = route.request()
      if (request.postDataJSON()?.operationName !== 'CreateChatbot') {
        await route.continue()
        return
      }

      createOperationCount += 1
      const response = await route.fetch()
      await createMutationGate.wait
      await route.fulfill({ response })
    })

    await page.getByTestId('create-chatbot').click()
    await page.getByTestId('create-chatbot-name').fill(FIRST_CHATBOT)
    await page
      .getByTestId('create-chatbot-description')
      .fill(`${FIRST_CHATBOT} description`)
    await selectOption(page, '[data-cy="create-chatbot-course"]', 'Testkurs')
    await page.getByTestId('submit-create-chatbot').click()

    await expect(page.getByTestId('create-chatbot-name')).toBeDisabled()
    await expect(page.getByTestId('create-chatbot-description')).toBeDisabled()
    await expect(page.getByTestId('create-chatbot-course')).toBeDisabled()
    await expect(page.getByTestId('cancel-create-chatbot')).toBeDisabled()

    createMutationGate.release()
    await expect(page.getByTestId(`chatbot-${FIRST_CHATBOT}`)).toBeVisible()
    await expectSetupTriggers(page)
    await expect.poll(() => createOperationCount).toBe(1)
    await expect
      .poll(() => new URL(page.url()).searchParams.get('view'))
      .toBe('knowledge')
    await expect
      .poll(() => new URL(page.url()).searchParams.get('step'))
      .toBeNull()
    await expect(
      page.getByTestId('chatbot-section-materials-toggle')
    ).toHaveAttribute('aria-expanded', 'true')

    const chatbotId = new URL(page.url()).searchParams.get('chatbotId')
    await page.goto(
      `${process.env.URL_MANAGE ?? URL_MANAGE}/resources/chatbots?chatbotId=${chatbotId}&view=invalid&step=invalid`
    )
    await expect
      .poll(() => new URL(page.url()).searchParams.get('view'))
      .toBe('overview')
    await expect
      .poll(() => new URL(page.url()).searchParams.get('step'))
      .toBeNull()
  })

  test('creates, edits, previews, switches, and reloads draft chatbots', async ({
    page,
  }) => {
    test.slow()
    const metadataRequestGate = createRequestGate()
    const modeRequestGate = createRequestGate()
    const disclaimerRequestGate = createRequestGate()
    const modelSettingsRequestGate = createRequestGate()
    let modeConfigVariables: Record<string, unknown> | undefined
    let modelPolicyVariables: Record<string, unknown> | undefined

    await page.route('**/api/graphql', async (route) => {
      const request = route.request()
      const postData = request.postData()
      const requestBody = postData
        ? (JSON.parse(postData) as {
            operationName?: string
            variables?: {
              input?: {
                metadata?: Record<string, unknown>
                modelPolicy?: Record<string, unknown>
                standardModeConfig?: Record<string, unknown>
                disclaimer?: Record<string, unknown>
              }
            }
          })
        : undefined
      const operationName = requestBody?.operationName
      const input = requestBody?.variables?.input
      if (operationName === 'MSaveChatbotRevision') {
        modeConfigVariables = input?.standardModeConfig
        modelPolicyVariables = input?.modelPolicy
      }
      const requestGate =
        operationName !== 'MSaveChatbotRevision'
          ? undefined
          : input?.modelPolicy
            ? modelSettingsRequestGate
            : input?.standardModeConfig
              ? modeRequestGate
              : input?.metadata
                ? metadataRequestGate
                : input?.disclaimer
                  ? disclaimerRequestGate
                  : undefined

      if (!requestGate) {
        await route.continue()
        return
      }

      const response = await route.fetch()
      await requestGate.wait
      await route.fulfill({ response })
    })

    const firstChatbotId = await createChatbot(page, FIRST_CHATBOT)
    await page.getByTestId('chatbot-edit-details').click()
    await expect(page.getByTestId('chatbot-edit-details-modal')).toBeVisible()

    await page
      .getByTestId('chatbot-description')
      .fill('Updated persisted description')
    await page.getByTestId('chatbot-edit-details-save').click()
    await expect(page.getByTestId('chatbot-name')).toBeDisabled()
    await expect(page.getByTestId('chatbot-description')).toBeDisabled()
    metadataRequestGate.release()
    await expect(page.getByTestId('chatbot-edit-details-modal')).toHaveCount(0)
    await openSection(page, 'students')
    await expect(page.getByTestId('chatbot-setup-disclaimer')).toBeVisible()

    await expect(page.getByTestId('content-input-bold')).toBeVisible()
    await expect(page.getByTestId('content-input-italic')).toBeVisible()
    await expect(page.getByTestId('content-input-numbered-list')).toBeVisible()
    await expect(page.getByTestId('content-input-bulleted-list')).toBeVisible()
    await expect(page.getByTestId('content-input-undo')).toBeVisible()
    await expect(page.getByTestId('content-input-redo')).toBeVisible()
    await expect(page.getByTestId('content-input-code')).toHaveCount(0)
    await expect(page.getByTestId('content-input-quote')).toHaveCount(0)
    await expect(page.getByTestId('open-image-input')).toHaveCount(0)
    await expect(page.getByTestId('open-video-embed-input')).toHaveCount(0)
    await expect(page.getByTestId('insert-inline-latex')).toHaveCount(0)
    await expect(page.getByTestId('insert-block-latex')).toHaveCount(0)

    await page
      .getByTestId('chatbot-disclaimer-title')
      .fill('Course chatbot conditions')
    await fillEditorField(
      page,
      'chatbot-disclaimer-intro',
      'Use this chatbot as a learning aid.'
    )
    const disclaimerEditor = page.getByTestId('chatbot-disclaimer-intro')
    // Closing a section keeps its unsaved edits.
    await page.getByTestId('chatbot-section-students-toggle').click()
    await expect(page.getByTestId('chatbot-setup-disclaimer')).not.toBeVisible()
    await expect(page.getByTestId('chatbot-section-students')).toHaveAttribute(
      'data-status',
      'unsaved'
    )
    await openSection(page, 'students')
    await expect(page.getByTestId('chatbot-disclaimer-title')).toHaveValue(
      'Course chatbot conditions'
    )
    await expect(disclaimerEditor).toContainText(
      'Use this chatbot as a learning aid.'
    )
    const boldButton = page.getByTestId('content-input-bold')
    await expect(boldButton).toHaveJSProperty('tagName', 'BUTTON')
    await boldButton.focus()
    await boldButton.press('Enter')
    await expect(boldButton).toHaveAttribute('aria-pressed', 'true')
    await disclaimerEditor.pressSequentially(' Verify important information.')
    await expect(disclaimerEditor.locator('strong')).toContainText(
      'Verify important information.'
    )
    // The preview dialog shows the unsaved edits.
    await page.getByTestId('chatbot-section-students-preview').click()
    await expect(
      page.getByTestId('chatbot-students-preview-modal')
    ).toBeVisible()
    const preview = page
      .getByTestId('chatbot-students-preview-modal')
      .getByTestId('chatbot-disclaimer-preview')
    await expect(preview).toContainText('Course chatbot conditions')
    await expect(preview).toContainText('Use this chatbot as a learning aid.')
    await expect(preview).toContainText('Student Responsibility')
    await expect(preview).toContainText('Data Protection')
    await expect(
      preview.getByTestId('chatbot-disclaimer-consequences')
    ).toContainText('Accept: You can use the chatbot')
    await page.keyboard.press('Escape')
    await expect(
      page.getByTestId('chatbot-students-preview-modal')
    ).toHaveCount(0)

    await page.getByTestId('chatbot-section-students-save').click()
    await expect(page.getByTestId('chatbot-disclaimer-title')).toBeDisabled()
    await expect(disclaimerEditor).toHaveAttribute('aria-disabled', 'true')
    await expect(disclaimerEditor).toHaveAttribute('contenteditable', 'false')
    for (const toolbarButton of [
      'content-input-bold',
      'content-input-italic',
      'content-input-numbered-list',
      'content-input-bulleted-list',
      'content-input-undo',
      'content-input-redo',
    ]) {
      await expect(page.getByTestId(toolbarButton)).toBeDisabled()
    }
    await disclaimerEditor.focus()
    await disclaimerEditor.dispatchEvent('keydown', {
      code: 'KeyI',
      ctrlKey: process.platform !== 'darwin',
      key: 'i',
      metaKey: process.platform === 'darwin',
    })
    await expect(page.getByTestId('content-input-italic')).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    const pendingDisclaimerUrl = page.url()
    const pendingNavigationAlertPromise = page
      .waitForEvent('dialog')
      .then((dialog) => {
        expect(dialog.type()).toBe('alert')
        return dialog.dismiss()
      })
    await page.getByTestId('create-chatbot').click()
    await pendingNavigationAlertPromise
    await expect.poll(() => page.url()).toBe(pendingDisclaimerUrl)
    disclaimerRequestGate.release()
    await expect(page.getByTestId('chatbot-disclaimer-title')).toBeEnabled()
    await expect(
      page.getByTestId('chatbot-section-students-toggle')
    ).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('chatbot-section-students')).toHaveAttribute(
      'data-status',
      'saved'
    )
    await navigateToSetupStep(page, 'review')

    await navigateToSetupStep(page, 'modes')
    await expect(page.getByTestId('chatbot-mode-switch-tutor')).toBeChecked()
    await expect(
      page.getByTestId('chatbot-mode-switch-explainer')
    ).toBeChecked()
    await expect(page.getByTestId('chatbot-mode-switch-quizzer')).toBeChecked()
    const framingField = page.getByTestId('chatbot-framing')
    await expect(framingField).toHaveAttribute('maxlength', '1000')
    await expect(framingField).toHaveValue('')
    const examples = page.getByTestId('chatbot-framing-examples')
    await examples.locator('summary').focus()
    await page.keyboard.press('Enter')
    await expect(examples).toHaveAttribute('open', '')
    await expect(framingField).toHaveValue('')
    const scopeNote = 'Synthetic audience context. '.repeat(40).slice(0, 1000)
    await framingField.fill(`${scopeNote}x`)
    await expect(framingField).toHaveValue(scopeNote)
    await expect(
      page.getByTestId('chatbot-mode-switch-writing-coach')
    ).not.toBeChecked()
    // Standard switches stay editable when another switch would otherwise
    // look like the last one, including the previous explanation lock.
    await setStandardModes(page, {
      tutorEnabled: false,
      explainerEnabled: true,
      quizzerEnabled: true,
      writingCoachEnabled: false,
    })
    await setStandardModes(page, {
      tutorEnabled: false,
      explainerEnabled: false,
      quizzerEnabled: true,
      writingCoachEnabled: false,
    })
    await setStandardModes(page, {
      tutorEnabled: true,
      explainerEnabled: false,
      quizzerEnabled: false,
      writingCoachEnabled: false,
    })
    await expect(page.getByTestId('chatbot-section-modes')).toHaveAttribute(
      'data-status',
      'unsaved'
    )
    await page.getByTestId('chatbot-section-modes-save').click()
    await expect(page.getByTestId('chatbot-section-modes-save')).toBeDisabled()
    await expect(page.getByTestId('chatbot-mode-switch-tutor')).toBeDisabled()
    await expect(
      page.getByTestId('chatbot-mode-switch-explainer')
    ).toBeDisabled()
    await expect(page.getByTestId('chatbot-mode-switch-quizzer')).toBeDisabled()
    await expect(page.getByTestId('chatbot-mode-capability-note')).toBeVisible()
    await expect
      .poll(() => modeConfigVariables)
      .toMatchObject({
        tutorEnabled: true,
        explainerEnabled: false,
        quizzerEnabled: false,
        courseName: null,
        subjectDomain: null,
        languageOfInstruction: null,
        writingCoachEnabled: false,
        scopeNote,
      })
    modeRequestGate.release()
    await expect(
      page.getByTestId('chatbot-section-modes-toggle')
    ).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('chatbot-section-modes')).toHaveAttribute(
      'data-status',
      'saved'
    )

    await navigateToSetupStep(page, 'review')
    await expect(page.getByTestId('chatbot-section-modes')).toHaveAttribute(
      'data-status',
      'saved'
    )
    await expect(
      page.getByTestId('chatbot-section-modes-summary')
    ).toBeVisible()
    await page.getByTestId('chatbot-edit-details').click()
    await expect(page.getByTestId('chatbot-edit-details-modal')).toBeVisible()
    await page.getByTestId('chatbot-edit-details-cancel').click()
    await expect(page.getByTestId('chatbot-edit-details-modal')).toHaveCount(0)

    await openSection(page, 'model')
    await expect(
      page.getByTestId('chatbot-model-selection-switch')
    ).not.toBeChecked()
    await expect(page.getByTestId('chatbot-fixed-model')).toContainText(
      'GPT-6 Luna'
    )
    await selectOption(page, '[data-cy="chatbot-reasoning-gpt-6-luna"]', 'high')
    await page.getByTestId('chatbot-model-selection-switch').click()
    await expect(page.getByTestId('chatbot-model-gpt-6-luna')).toBeChecked()
    await expect(
      page.getByTestId('chatbot-reasoning-gpt-6-luna-high')
    ).toBeChecked()
    await page.getByTestId('chatbot-model-auto').click()
    await expect(page.getByTestId('chatbot-section-model')).toHaveAttribute(
      'data-status',
      'unsaved'
    )
    const advancedUrl = page.url()
    // Going back leaves the document loaded by the last page.goto, so the
    // browser's leave-page prompt guards the unsaved changes.
    const historyDiscardDialogPromise = page
      .waitForEvent('dialog')
      .then((dialog) => {
        expect(dialog.type()).toBe('beforeunload')
        return dialog.dismiss()
      })
    await page.evaluate(() => window.history.back())
    await historyDiscardDialogPromise
    await expect.poll(() => page.url()).toBe(advancedUrl)
    await expect(page.getByTestId('chatbot-section-model')).toHaveAttribute(
      'data-status',
      'unsaved'
    )

    const createDiscardDialogPromise = page
      .waitForEvent('dialog')
      .then((dialog) => {
        expect(dialog.message()).toBe('Discard your unsaved chatbot changes?')
        return dialog.dismiss()
      })
    await page.getByTestId('create-chatbot').click()
    await createDiscardDialogPromise
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByTestId('chatbot-section-model')).toHaveAttribute(
      'data-status',
      'unsaved'
    )
    const acceptedCreateDiscardDialogPromise = page
      .waitForEvent('dialog')
      .then((dialog) => {
        expect(dialog.message()).toBe('Discard your unsaved chatbot changes?')
        return dialog.accept()
      })
    await page.getByTestId('create-chatbot').click()
    await acceptedCreateDiscardDialogPromise
    await expect(page.getByTestId('cancel-create-chatbot')).toBeVisible()
    await page.getByTestId('cancel-create-chatbot').click()
    await openSection(page, 'model')
    await expect(page.getByTestId('chatbot-section-model')).toHaveAttribute(
      'data-status',
      'unsaved'
    )
    const answerPreferencesSwitch = page.getByTestId(
      'chatbot-answer-preferences-switch'
    )
    await expect(answerPreferencesSwitch).toBeChecked()
    await answerPreferencesSwitch.click()
    await expect(answerPreferencesSwitch).not.toBeChecked()
    await page.getByTestId('chatbot-section-model-save').click()
    await expect(
      page.getByTestId('chatbot-model-selection-switch')
    ).toBeDisabled()
    await expect(page.getByTestId('chatbot-models-all')).toHaveCount(0)
    for (const checkbox of await page
      .locator(
        '[data-cy^="chatbot-model-"]:not([data-cy="chatbot-model-selection-switch"])'
      )
      .all()) {
      await expect(checkbox).toBeDisabled()
    }
    await expect(
      page.getByTestId('chatbot-reasoning-gpt-6-luna-high')
    ).toBeDisabled()
    await expect
      .poll(() => modelPolicyVariables)
      .toMatchObject({
        modelSelection: true,
        allowedModelIds: ['auto', 'gpt-6-luna'],
        allowedReasoningEffortsByModel: [
          { modelId: 'gpt-6-luna', efforts: ['high'] },
        ],
        answerPreferencesEnabled: false,
      })
    modelSettingsRequestGate.release()
    await expect(
      page.getByTestId('chatbot-section-model-toggle')
    ).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('chatbot-section-model')).toHaveAttribute(
      'data-status',
      'saved'
    )

    await openSection(page, 'usage')
    await expect(page.getByTestId('chatbot-credit-policy-form')).toBeVisible()

    await createChatbot(page, SECOND_CHATBOT)
    await expect(page.getByTestId('chatbot-disclaimer-title')).not.toHaveValue(
      ''
    )
    await expect(page.getByTestId('chatbot-setup-disclaimer')).toBeVisible()

    await page.setViewportSize({ width: 800, height: 900 })
    await selectOption(
      page,
      '[data-cy="chatbot-mobile-selector"]',
      `${FIRST_CHATBOT} (Draft)`
    )
    await expect(page.getByTestId('chatbot-mobile-selector')).toContainText(
      FIRST_CHATBOT
    )
    await page.setViewportSize({ width: 1280, height: 900 })

    await page.getByTestId(`chatbot-${FIRST_CHATBOT}`).click()
    await navigateToSetupStep(page, 'basics')
    await expect(page.getByTestId('chatbot-name')).toHaveValue(FIRST_CHATBOT)
    await expect(page.getByTestId('chatbot-description')).toHaveValue(
      'Updated persisted description'
    )
    await page.getByTestId('chatbot-edit-details-cancel').click()
    await navigateToSetupStep(page, 'disclaimer')
    await expect(page.getByTestId('chatbot-disclaimer-title')).toHaveValue(
      'Course chatbot conditions'
    )
    await expect(page.getByTestId('chatbot-disclaimer-intro')).toContainText(
      'Use this chatbot as a learning aid.'
    )
    await expect(
      page.getByTestId('chatbot-disclaimer-intro').locator('strong')
    ).toContainText('Verify important information.')

    await navigateToSetupStep(page, 'review')
    await expect(page.getByTestId('chatbot-edit-details-modal')).toHaveCount(0)
    await expect(
      page.getByTestId('chatbot-section-students-toggle')
    ).toHaveAttribute('aria-expanded', 'false')

    await page.reload()
    await expect(page.getByTestId('chatbot-setup-review')).toBeVisible()
    await navigateToSetupStep(page, 'modes')
    await expect(page.getByTestId('chatbot-mode-switch-tutor')).toBeChecked()
    await expect(page.getByTestId('chatbot-framing')).toHaveValue(scopeNote)
    await expect(
      page.getByTestId('chatbot-mode-switch-explainer')
    ).not.toBeChecked()
    await expect(
      page.getByTestId('chatbot-mode-switch-quizzer')
    ).not.toBeChecked()

    const legacyScopeNote = 'Legacy framing. '.repeat(20).trim()
    expect(legacyScopeNote.length).toBeGreaterThan(200)
    const prisma = await getPrisma()
    // Model a chatbot from before authoring revisions: clear the saved
    // snapshot so the UI reads the live columns directly, as it does for
    // rows that never had a revision.
    await prisma.chatbot.update({
      where: { id: firstChatbotId },
      data: {
        standardModeConfig: {
          tutorEnabled: true,
          explainerEnabled: false,
          quizzerEnabled: false,
          courseName: null,
          subjectDomain: null,
          languageOfInstruction: null,
          scopeNote: legacyScopeNote,
        },
        draftConfig: Prisma.DbNull,
        revisionStatus: null,
        revisionVersion: 0,
      },
    })
    await page.reload()
    await navigateToSetupStep(page, 'modes')
    await expect(page.getByTestId('chatbot-framing')).toHaveValue(
      legacyScopeNote
    )
    modeConfigVariables = undefined
    await page.getByTestId('chatbot-mode-switch-explainer').click()
    await page.getByTestId('chatbot-section-modes-save').click()
    await expect
      .poll(() => modeConfigVariables)
      .toMatchObject({
        tutorEnabled: true,
        explainerEnabled: true,
        quizzerEnabled: false,
        scopeNote: legacyScopeNote,
      })
    await expect(
      page.getByTestId('chatbot-section-modes-toggle')
    ).toHaveAttribute('aria-expanded', 'false')
    await page.reload()
    await navigateToSetupStep(page, 'modes')
    await expect(page.getByTestId('chatbot-framing')).toHaveValue(
      legacyScopeNote
    )
    await setStandardModes(page, {
      tutorEnabled: false,
      explainerEnabled: false,
      quizzerEnabled: false,
      writingCoachEnabled: true,
    })
    await page.getByTestId('chatbot-section-modes-save').click()
    await expect
      .poll(() => modeConfigVariables)
      .toMatchObject({
        tutorEnabled: false,
        explainerEnabled: false,
        quizzerEnabled: false,
        writingCoachEnabled: true,
        scopeNote: legacyScopeNote,
      })
    await expect
      .poll(async () =>
        prisma.chatbot.findUnique({
          where: { id: firstChatbotId },
          select: { standardModeConfig: true },
        })
      )
      .toMatchObject({
        standardModeConfig: {
          writingCoachEnabled: true,
          tutorEnabled: false,
          explainerEnabled: false,
        },
      })
    await page.reload()
    await navigateToSetupStep(page, 'modes')
    await expect(
      page.getByTestId('chatbot-mode-switch-writing-coach')
    ).toBeChecked()
    await expect(
      page.getByTestId('chatbot-mode-switch-tutor')
    ).not.toBeChecked()
    await expect(
      page.getByTestId('chatbot-mode-switch-explainer')
    ).not.toBeChecked()
    await navigateToSetupStep(page, 'basics')
    await expect(page.getByTestId('chatbot-name')).toHaveValue(FIRST_CHATBOT)
    await expect(page.getByTestId('chatbot-description')).toHaveValue(
      'Updated persisted description'
    )
    await navigateToSetupStep(page, 'disclaimer')
    await expect(page.getByTestId('chatbot-disclaimer-intro')).toContainText(
      'Use this chatbot as a learning aid.'
    )
    await expect(
      page.getByTestId('chatbot-disclaimer-intro').locator('strong')
    ).toContainText('Verify important information.')
  })

  test('authors a custom mode that survives save and publication', async ({
    page,
  }, testInfo) => {
    test.slow()
    const personaText = [
      'Challenge the participant with counter-arguments.',
      'Ask one question at a time.\nWait for the participant to respond.',
      'After the conversation, give feedback on the arguments presented.',
    ].join('\n\n')
    const welcomeMessage =
      'Welcome to the synthetic debate.\nChoose a position to begin.'
    const starterPrompts = [
      'Begin the synthetic debate',
      'Explain the exercise',
    ]
    let customModeConfigVariables: Record<string, unknown> | undefined
    await page.route('**/api/graphql', async (route) => {
      const request = route.request()
      if (request.postDataJSON()?.operationName === 'MSaveChatbotRevision') {
        customModeConfigVariables =
          request.postDataJSON()?.variables?.input?.customModeConfig
      }
      await route.continue()
    })

    const chatbotId = await createChatbot(page, `${CHATBOT_PREFIX} Custom Mode`)
    await navigateToSetupStep(page, 'modes')
    await expect(page.getByTestId('chatbot-custom-modes-form')).toBeVisible()
    await expect(page.getByTestId('chatbot-custom-modes-empty')).toBeVisible()
    await expect(page.getByTestId('add-chatbot-custom-mode')).toBeEnabled()

    await page.getByTestId('add-chatbot-custom-mode').click()
    await expect(page.getByTestId('chatbot-custom-mode-name-0')).toBeVisible()
    await page.getByTestId('chatbot-custom-mode-name-0').fill('Debate coach')
    await page
      .getByTestId('chatbot-custom-mode-description-0')
      .fill('Argues both sides of a course question.')
    await page.getByTestId('chatbot-custom-mode-persona-0').fill(personaText)
    await page.getByTestId('chatbot-custom-mode-welcome-0').fill(welcomeMessage)
    for (let index = 0; index < 4; index += 1) {
      await page.getByTestId('add-chatbot-custom-mode-starter-0').click()
      if (starterPrompts[index]) {
        await page
          .getByTestId(`chatbot-custom-mode-starter-0-${index}`)
          .fill(starterPrompts[index])
      }
    }
    await expect(
      page.getByTestId('add-chatbot-custom-mode-starter-0')
    ).toBeDisabled()
    await page.getByTestId('remove-chatbot-custom-mode-starter-0-3').click()
    await expect(
      page.getByTestId('add-chatbot-custom-mode-starter-0')
    ).toBeEnabled()
    await setStandardModes(page, {
      tutorEnabled: false,
      explainerEnabled: false,
      quizzerEnabled: false,
      writingCoachEnabled: false,
    })
    await expect(page.getByTestId('chatbot-section-modes')).toHaveAttribute(
      'data-status',
      'unsaved'
    )
    await expect(page.getByTestId('chatbot-section-modes-save')).toBeEnabled()
    await page.getByTestId('chatbot-section-modes-save').click()
    await expect
      .poll(() => customModeConfigVariables)
      .toMatchObject({
        modes: [
          {
            key: null,
            name: 'Debate coach',
            description: 'Argues both sides of a course question.',
            personaText,
            welcomeMessage,
            starterPrompts,
          },
        ],
      })
    await expect(
      page.getByTestId('chatbot-section-modes-toggle')
    ).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('chatbot-section-modes')).toHaveAttribute(
      'data-status',
      'saved'
    )

    await page.reload()
    await navigateToSetupStep(page, 'modes')
    await expect(page.getByTestId('chatbot-custom-mode-name-0')).toHaveValue(
      'Debate coach'
    )
    await expect(
      page.getByTestId('chatbot-custom-mode-description-0')
    ).toHaveValue('Argues both sides of a course question.')
    await expect(page.getByTestId('chatbot-custom-mode-persona-0')).toHaveValue(
      personaText
    )
    await expect(page.getByTestId('chatbot-custom-mode-welcome-0')).toHaveValue(
      welcomeMessage
    )
    for (let index = 0; index < starterPrompts.length; index += 1) {
      await expect(
        page.getByTestId(`chatbot-custom-mode-starter-0-${index}`)
      ).toHaveValue(starterPrompts[index])
    }
    await expect(
      page.getByTestId('chatbot-custom-mode-starter-0-2')
    ).toHaveCount(0)
    await expectStandardModes(page, {
      tutorEnabled: false,
      explainerEnabled: false,
      quizzerEnabled: false,
      writingCoachEnabled: false,
    })

    const prisma = await getPrisma()
    const saved = await prisma.chatbot.findUniqueOrThrow({
      where: { id: chatbotId },
      select: { draftConfig: true },
    })
    const savedDraft = saved.draftConfig as {
      customModeConfig: { modes: { key: string }[] }
      standardModeConfig: Record<string, unknown>
    }
    const customMode = savedDraft.customModeConfig.modes[0]
    if (!customMode) throw new Error('Expected the saved custom mode')
    expect(customMode.key).toMatch(/^cm_/)
    expect(savedDraft.standardModeConfig).toMatchObject({
      tutorEnabled: false,
      explainerEnabled: false,
      quizzerEnabled: false,
      writingCoachEnabled: false,
      explicitModeSelection: true,
    })

    await exerciseOwnerPreview(page, testInfo, {
      chatbotId,
      selectedMode: customMode.key,
      welcomeTestId: 'chat-custom-mode-welcome',
      welcomeText: welcomeMessage,
      turn: {
        prompt: 'Start the custom-only preview',
        reply: 'Synthetic custom-only preview reply.',
      },
      screenshotName: 'custom-only-owner-preview',
    })

    // Approval only applies to a revision that was submitted for review, so the
    // draft has to pass the publication gate before it can be approved.
    await setPublishingAuthorization(true)
    await page.reload()
    await submitChatbotRevision(
      page,
      'Support students with a synthetic study aid.'
    )

    const revision = await prisma.chatbot.findUniqueOrThrow({
      where: { id: chatbotId },
      select: { revisionVersion: true, draftConfig: true },
    })
    const approvedCustomMode = (
      revision.draftConfig as { customModeConfig: { modes: { key: string }[] } }
    ).customModeConfig.modes[0]
    await page.goto(`${process.env.URL_MANAGE ?? URL_MANAGE}/admin`)
    await page.getByTestId(`open-chatbot-review-${chatbotId}`).click()
    await expect(
      page.getByTestId(`chatbot-admin-review-welcome-${approvedCustomMode.key}`)
    ).toContainText(welcomeMessage)
    for (const starter of starterPrompts) {
      await expect(
        page.getByTestId(
          `chatbot-admin-review-starters-${approvedCustomMode.key}`
        )
      ).toContainText(starter)
    }
    await approveRevision(page, chatbotId, revision.revisionVersion)
    await page.goto(
      `${process.env.URL_MANAGE ?? URL_MANAGE}/resources/chatbots?chatbotId=${chatbotId}`
    )
    await navigateToSetupStep(page, 'modes')
    await expect(page.getByTestId('chatbot-custom-mode-name-0')).toHaveValue(
      'Debate coach'
    )

    await exerciseParticipantJourney(page, testInfo, {
      chatbotId,
      selectedMode: approvedCustomMode.key,
      welcomeTestId: 'chat-custom-mode-welcome',
      welcomeText: welcomeMessage,
      standaloneTurns: [
        {
          prompt: 'Open the standalone custom mode',
          reply: 'Synthetic custom-only standalone reply.',
        },
      ],
      embeddedTurn: {
        prompt: 'Open the embedded custom mode',
        reply: 'Synthetic custom-only embedded reply.',
      },
      screenshotName: 'custom-only-participant',
    })
  })

  test('publishes distinct sources for two modes in one learner conversation', async ({
    page,
  }, testInfo) => {
    test.slow()
    const prisma = await getPrisma()
    const chatbotId = await createChatbot(
      page,
      `${CHATBOT_PREFIX} Mode sources`
    )
    const modes = ['Case discussion', 'Exam practice']
    const books = ['Casebook', 'Question bank']
    const links = await Promise.all(
      books.map((name) =>
        prisma.kBChatbot.create({
          data: {
            chatbot: { connect: { id: chatbotId } },
            kb: {
              create: {
                name: `${CHATBOT_PREFIX} ${name}`,
                ownerId: USER_ID_TEST,
              },
            },
          },
          include: { kb: true },
        })
      )
    )

    await navigateToSetupStep(page, 'modes')
    for (const [index, name] of modes.entries()) {
      await page.getByTestId('add-chatbot-custom-mode').click()
      await page.getByTestId(`chatbot-custom-mode-name-${index}`).fill(name)
      await page
        .getByTestId(`chatbot-custom-mode-persona-${index}`)
        .fill(`Discuss the assigned ${books[index]}.`)
      await page
        .getByTestId(`chatbot-custom-mode-knowledge-base-${index}`)
        .click()
      await page
        .getByTestId(`chatbot-custom-mode-kb-${index}-${links[index]!.id}`)
        .click()
    }
    await setStandardModes(page, {
      tutorEnabled: false,
      explainerEnabled: false,
      quizzerEnabled: false,
      writingCoachEnabled: false,
    })
    await page
      .getByTestId('chatbot-custom-mode-knowledge-base-0')
      .scrollIntoViewIfNeeded()
    await attachScreenshot(testInfo, page, 'lecturer-per-mode-sources')
    await saveSection(page, 'modes')
    await setPublishingAuthorization(true)
    await page.reload()
    await submitChatbotRevision(
      page,
      'Practice using separate synthetic reading collections.'
    )
    const saved = await prisma.chatbot.findUniqueOrThrow({
      where: { id: chatbotId },
    })
    const revision = saved.draftConfig as {
      customModeConfig: {
        modes: { key: string; knowledgeBaseLinkId: string }[]
      }
    }
    const [first, second] = revision.customModeConfig.modes
    expect(
      revision.customModeConfig.modes.map((mode) => mode.knowledgeBaseLinkId)
    ).toEqual(links.map((link) => link.id))
    await page.goto(`${process.env.URL_MANAGE ?? URL_MANAGE}/admin`)
    await page.getByTestId(`open-chatbot-review-${chatbotId}`).click()
    for (const [index, mode] of revision.customModeConfig.modes.entries()) {
      await expect(
        page.getByTestId(`chatbot-admin-review-knowledge-base-${mode.key}`)
      ).toContainText(links[index]!.kb.name)
    }
    await page
      .getByTestId(`chatbot-admin-review-knowledge-base-${second!.key}`)
      .scrollIntoViewIfNeeded()
    await attachScreenshot(testInfo, page, 'review-per-mode-sources')
    await approveRevision(page, chatbotId, saved.revisionVersion)

    const historyText = 'We discussed the first case together.'
    const thread = await prisma.chatThread.create({
      data: {
        chatbotId,
        participantId: await getEnrolledParticipantId(),
        title: 'Source switching',
        messages: {
          create: {
            role: 'assistant',
            chatMode: first!.key,
            content: [{ type: 'text', text: historyText }],
          },
        },
      },
    })
    const participant = await page.context().newPage()
    try {
      await mockChatStream(
        participant,
        { textByCall: ['Practice reply', 'Case reply'] },
        chatbotId
      )
      await visitParticipantChat(participant, chatbotId)
      await participant.getByTestId('chat-thread-select').first().click()
      await expect(participant).toHaveURL((url) =>
        url.pathname.endsWith(`/threads/${thread.id}`)
      )
      await expect(
        participant.getByTestId('chat-assistant-message-content').first()
      ).toContainText(historyText)
      for (const [key, prompt, reply] of [
        [second!.key, 'Practice a question about that case.', 'Practice reply'],
        [first!.key, 'Return to the original case.', 'Case reply'],
      ] as const) {
        await participant.getByTestId('chat-mode-switcher').click()
        await participant.getByTestId(`chat-mode-option-${key}`).click()
        const request = participant.waitForRequest(
          (candidate) =>
            candidate.method() === 'POST' &&
            candidate.url().endsWith(`/api/chatbots/${chatbotId}/chat`)
        )
        await sendChatTurn(participant, chatbotId, key, { prompt, reply })
        const body = (await request).postDataJSON()
        expect(body.threadId).toBe(thread.id)
        expect(body.messages).toContainEqual(
          expect.objectContaining({ role: 'assistant', content: historyText })
        )
      }
      await attachScreenshot(testInfo, participant, 'learner-shared-history')
      await participant.reload()
      await expect(participant).toHaveURL((url) =>
        url.pathname.endsWith(`/threads/${thread.id}`)
      )
      await expect(
        participant.getByTestId('chat-assistant-message-content').first()
      ).toContainText(historyText)
    } finally {
      await participant.close()
    }
  })

  test('shows approved and draft inherited custom modes for default detach', async ({
    page,
  }) => {
    const prisma = await getPrisma()
    const chatbot = await seedPublicationChatbot({
      name: `${CHATBOT_PREFIX} Default source impact`,
      status: 'DRAFT',
      withDisclaimer: true,
    })
    await prisma.chatbot.update({
      where: { id: chatbot.id },
      data: {
        standardModeConfig: {
          tutorEnabled: true,
          explainerEnabled: false,
          quizzerEnabled: false,
          scopeNote: null,
        },
      },
    })
    const kb = await prisma.kB.create({
      data: {
        name: `${CHATBOT_PREFIX} Casebook`,
        ownerId: USER_ID_TEST,
      },
    })
    const link = await prisma.kBChatbot.create({
      data: {
        chatbotId: chatbot.id,
        kbId: kb.id,
        isEnabled: true,
        isDefault: true,
      },
    })
    await prisma.chatbot.update({
      where: { id: chatbot.id },
      data: {
        customModeConfig: {
          modes: [
            {
              key: 'cm_default_inherited',
              name: 'Inherited reader',
              description: null,
              personaText: null,
            },
            {
              key: 'cm_default_explicit',
              name: 'Explicit reader',
              description: null,
              personaText: null,
              knowledgeBaseLinkId: link.id,
            },
          ],
        },
      },
    })
    await prisma.chatbot.update({
      where: { id: chatbot.id },
      data: {
        draftConfig: {
          name: chatbot.name,
          description: chatbot.description,
          avatar: chatbot.avatar,
          standardModeConfig: {
            tutorEnabled: true,
            explainerEnabled: false,
            quizzerEnabled: false,
            scopeNote: null,
          },
          customModeConfig: {
            modes: [
              {
                key: 'cm_default_inherited',
                name: 'Draft inherited reader',
                description: null,
                personaText: null,
              },
              {
                key: 'cm_default_explicit',
                name: 'Draft explicit reader',
                description: null,
                personaText: null,
                knowledgeBaseLinkId: link.id,
              },
            ],
          },
          modelSelection: chatbot.modelSelection,
          allowedModelIds: chatbot.allowedModelIds,
          creditInitialCredits: chatbot.creditInitialCredits,
          creditResetPeriod: chatbot.creditResetPeriod,
          creditResetAmount: chatbot.creditResetAmount,
          creditMaxCredits: chatbot.creditMaxCredits,
          disclaimerTitle: null,
          disclaimerIntroText: null,
          publicationUseCase: null,
        },
        revisionVersion: 1,
      },
    })

    await page.route('**/api/graphql*', async (route) => {
      const request = route.request()
      const operationName =
        new URL(request.url()).searchParams.get('operationName') ??
        request.postDataJSON()?.operationName
      if (operationName !== 'QGetChatbotsInfoWithKnowledgeBases') {
        await route.fallback()
        return
      }
      const response = await route.fetch()
      const json = await response.json()
      for (const item of json.data?.getChatbotsInfo ?? []) {
        item.perModeKbLinksEnabled = true
      }
      await route.fulfill({ response, json })
    })

    await page.goto(
      `${process.env.URL_MANAGE ?? URL_MANAGE}/resources/chatbots?chatbotId=${chatbot.id}&view=knowledge&step=materials`
    )
    await expect(page.getByTestId('chatbot-kb-default-badge')).toBeVisible()
    await page.getByTestId(`chatbot-kb-actions-${kb.id}`).click()
    await page.getByTestId(`chatbot-kb-detach-${kb.id}`).click()

    const detachModal = page.getByTestId('chatbot-kb-detach-modal')
    const approvedImpact = detachModal.getByTestId(
      'chatbot-kb-detach-approved-impact'
    )
    await expect(approvedImpact).toContainText('Inherited reader')
    await expect(approvedImpact).toContainText('Explicit reader')
    const draftImpact = detachModal.getByTestId(
      'chatbot-kb-detach-draft-impact'
    )
    await expect(draftImpact).toContainText('Draft inherited reader')
    await expect(draftImpact).toContainText('Draft explicit reader')
    await page.getByTestId('cancel-chatbot-kb-detach').click()
  })

  test('publishes KB-free Quizzer alone and exercises preview plus both participant surfaces', async ({
    page,
  }, testInfo) => {
    test.slow()
    await setPublishingAuthorization(true)
    await page.reload()
    const chatbotId = await createChatbot(
      page,
      `${CHATBOT_PREFIX} Quizzer Only`
    )
    await navigateToSetupStep(page, 'modes')
    await setStandardModes(page, {
      tutorEnabled: false,
      explainerEnabled: false,
      quizzerEnabled: true,
      writingCoachEnabled: false,
    })
    await saveSection(page, 'modes')

    const prisma = await getPrisma()

    await exerciseOwnerPreview(page, testInfo, {
      chatbotId,
      selectedMode: 'quizzer',
      welcomeTestId: 'chat-welcome-mode',
      welcomeText: enMessages.chat.modes.quizzer,
      turn: {
        prompt: 'Ask me a practice question about respiration',
        reply: 'Synthetic preview practice question.',
      },
      screenshotName: 'quizzer-owner-preview',
    })

    await submitChatbotRevision(
      page,
      'Offer synthetic practice without a course knowledge base.'
    )
    const revision = await prisma.chatbot.findUniqueOrThrow({
      where: { id: chatbotId },
      select: { revisionVersion: true },
    })
    await approveRevision(page, chatbotId, revision.revisionVersion)

    const published = await prisma.chatbot.findUniqueOrThrow({
      where: { id: chatbotId },
      select: {
        status: true,
        standardModeConfig: true,
        _count: { select: { knowledgeBases: true } },
      },
    })
    expect(published).toMatchObject({
      status: 'PUBLISHED',
      standardModeConfig: {
        tutorEnabled: false,
        explainerEnabled: false,
        quizzerEnabled: true,
        writingCoachEnabled: false,
        explicitModeSelection: true,
      },
      _count: { knowledgeBases: 0 },
    })

    const question =
      'Synthetic practice question: Which process produces most ATP?'
    const feedback =
      'Synthetic feedback: Correct, oxidative phosphorylation produces most ATP.'
    await exerciseParticipantJourney(page, testInfo, {
      chatbotId,
      selectedMode: 'quizzer',
      welcomeTestId: 'chat-welcome-mode',
      welcomeText: enMessages.chat.modes.quizzer,
      standaloneTurns: [
        {
          prompt: 'Ask me a practice question about cellular energy',
          reply: question,
        },
        {
          prompt: 'Oxidative phosphorylation',
          reply: feedback,
        },
      ],
      embeddedTurn: {
        prompt: 'Ask an embedded practice question',
        reply: 'Synthetic embedded Quizzer practice reply.',
      },
      screenshotName: 'quizzer-participant',
    })
  })

  test('stops adding custom modes at the platform limit', async ({ page }) => {
    const chatbotId = await createChatbot(
      page,
      `${CHATBOT_PREFIX} Custom Mode Limit`
    )
    const prisma = await getPrisma()
    await prisma.chatbot.update({
      where: { id: chatbotId },
      data: {
        customModeConfig: {
          modes: [1, 2, 3, 4, 5].map((number) => ({
            key: `cm_seed-${number}`,
            name: `Alpha-${number}`,
            description: null,
            personaText: null,
          })),
        },
      },
    })

    await page.reload()
    await navigateToSetupStep(page, 'modes')
    await expect(page.getByTestId('chatbot-custom-mode-name-4')).toHaveValue(
      'Alpha-5'
    )
    await expect(page.getByText('5 of 5')).toBeVisible()
    await expect(page.getByTestId('add-chatbot-custom-mode')).toBeDisabled()

    await page.getByTestId('remove-chatbot-custom-mode-0').click()
    await expect(page.getByText('4 of 5')).toBeVisible()
    await expect(page.getByTestId('add-chatbot-custom-mode')).toBeEnabled()
    await expect(page.getByTestId('chatbot-custom-mode-name-0')).toHaveValue(
      'Alpha-2'
    )
    await page.getByTestId('add-chatbot-custom-mode').click()
    await expect(page.getByTestId('chatbot-custom-mode-name-4')).toBeVisible()
    await expect(page.getByTestId('add-chatbot-custom-mode')).toBeDisabled()
  })

  test('submits a complete draft and locks publication details while pending', async ({
    page,
  }) => {
    await setPublishingAuthorization(true)
    await page.reload()
    await createChatbot(page, `${CHATBOT_PREFIX} Publication`)

    await navigateToSetupStep(page, 'credits')
    await page.getByTestId('chatbot-credit-initial').fill('25')
    await page.getByTestId('chatbot-credit-reset-amount').fill('15')
    await page.getByTestId('chatbot-credit-maximum').fill('100')
    await expect(page.getByTestId('chatbot-section-usage')).toHaveAttribute(
      'data-status',
      'unsaved'
    )
    await saveSection(page, 'usage')
    await expect(page.getByTestId('chatbot-section-usage')).toHaveAttribute(
      'data-status',
      'saved'
    )
    await navigateToSetupStep(page, 'review')

    await fillPublicationRequest(
      page,
      'Support students with a synthetic study aid.'
    )
    const submitButton = page.getByTestId('request-chatbot-publication')
    await expect(submitButton).toBeEnabled()

    await openSection(page, 'students')
    await page
      .getByTestId('chatbot-disclaimer-title')
      .fill('Synthetic publication disclaimer')
    await fillEditorField(
      page,
      'chatbot-disclaimer-intro',
      'Synthetic disclaimer content for publication.'
    )
    await expect(submitButton).toBeDisabled()
    await expect(
      page.getByTestId('chatbot-publication-blocker-students')
    ).toBeVisible()

    const disclaimerSaveGate = createRequestGate()
    await page.route('**/api/graphql', async (route) => {
      const request = route.request()
      if (
        request.postDataJSON()?.operationName !== 'MSaveChatbotRevision' ||
        !request.postDataJSON()?.variables?.input?.disclaimer
      ) {
        await route.continue()
        return
      }

      const response = await route.fetch()
      await disclaimerSaveGate.wait
      await route.fulfill({ response })
    })
    await page.getByTestId('chatbot-section-students-save').click()
    await expect(submitButton).toBeDisabled()
    disclaimerSaveGate.release()
    await expect(
      page.getByTestId('chatbot-section-students-toggle')
    ).toHaveAttribute('aria-expanded', 'false')
    await expect(submitButton).toBeEnabled()
    await expect(page.getByTestId('chatbot-publication-blockers')).toHaveCount(
      0
    )

    const publicationRequestGate = createRequestGate()
    // While the mutation is in flight, all publication inputs lock with the
    // submit button so late edits cannot diverge from the submitted payload.
    await page.route('**/api/graphql', async (route) => {
      const request = route.request()
      if (request.postDataJSON()?.operationName !== 'MSubmitChatbotRevision') {
        await route.continue()
        return
      }

      const response = await route.fetch()
      await publicationRequestGate.wait
      await route.fulfill({ response })
    })
    await submitButton.click()
    await expect(submitButton).toBeDisabled()
    await expect(page.getByTestId('chatbot-disclaimer-title')).toBeDisabled()
    await expect(
      page.getByTestId('chatbot-publication-use-case')
    ).toBeDisabled()
    await expect(
      page.getByTestId('chatbot-publication-expected-student-count')
    ).toBeDisabled()
    await page.getByTestId('chatbot-edit-details').click()
    await expect(page.getByTestId('chatbot-name')).toBeDisabled()
    await page.getByTestId('chatbot-edit-details-cancel').click()
    const pendingNavigationUrl = page.url()
    const pendingNavigationAlertPromise = page
      .waitForEvent('dialog')
      .then((dialog) => {
        expect(dialog.type()).toBe('alert')
        return dialog.dismiss()
      })
    await page.getByTestId('create-chatbot').click()
    await pendingNavigationAlertPromise
    await expect.poll(() => page.url()).toBe(pendingNavigationUrl)

    publicationRequestGate.release()
    await expect(
      page.getByTestId('chatbot-details').getByTestId('chatbot-status')
    ).toHaveText('Pending approval')
    await expect(
      page.getByTestId('chatbot-publication-readonly')
    ).toContainText('awaiting publication review')
    await expect(page.getByTestId('chatbot-draft-setup')).toBeVisible()
    await page.getByTestId('chatbot-section-students-preview').click()
    const pendingPreview = page
      .getByTestId('chatbot-students-preview-modal')
      .getByTestId('chatbot-disclaimer-preview')
    await expect(pendingPreview).toContainText(
      'Synthetic publication disclaimer'
    )
    await expect(pendingPreview).toContainText('Student Responsibility')
    await page.keyboard.press('Escape')
    await expect(
      page.getByTestId('chatbot-students-preview-modal')
    ).toHaveCount(0)
    await expect(page.getByTestId('chatbot-publication-use-case')).toHaveCount(
      0
    )
    await expect(
      page.getByTestId('chatbot-publication-expected-student-count')
    ).toHaveCount(0)

    const prisma = await getPrisma()
    const chatbot = await prisma.chatbot.findFirst({
      where: { name: `${CHATBOT_PREFIX} Publication` },
      select: {
        id: true,
        status: true,
        publicationUseCase: true,
        expectedStudentCount: true,
        creditInitialCredits: true,
        creditResetPeriod: true,
        creditResetAmount: true,
        creditMaxCredits: true,
        revisionVersion: true,
        draftConfig: true,
      },
    })
    expect(chatbot).toMatchObject({
      status: 'PENDING_APPROVAL',
      publicationUseCase: 'Support students with a synthetic study aid.',
      expectedStudentCount: 40,
      creditInitialCredits: 25,
      // The form never offers the reset period, so this is the policy a newly
      // created chatbot receives from the server.
      creditResetPeriod: 'DAILY',
      creditResetAmount: 15,
      creditMaxCredits: 100,
    })

    if (!chatbot) throw new Error('Expected the publication chatbot to exist')
    await approveRevision(page, chatbot.id, chatbot.revisionVersion)
    await page.goto(
      `${process.env.URL_MANAGE ?? URL_MANAGE}/resources/chatbots?chatbotId=${chatbot.id}`
    )
    await expect(page.getByTestId('chatbot-usage-strip')).toBeVisible()
    await expect(page.getByTestId('chatbot-participant-link')).toBeVisible()
    await page.getByTestId('chatbot-section-students-preview').click()
    const publishedPreview = page
      .getByTestId('chatbot-students-preview-modal')
      .getByTestId('chatbot-disclaimer-preview')
    await expect(publishedPreview).toContainText(
      'Synthetic publication disclaimer'
    )
    await expect(publishedPreview).toContainText(
      'Synthetic disclaimer content for publication.'
    )
    await expect(publishedPreview).toContainText('Student Responsibility')
    await expect(publishedPreview).toContainText('Data Protection')
    await page.keyboard.press('Escape')
    // Approval clears the revision, so a published chatbot offers no request
    // until a section saves a new one.
    await expect(page.getByTestId('chatbot-section-request')).toHaveCount(0)
    // Details of a published chatbot stay editable.
    await page.getByTestId('chatbot-edit-details').click()
    await expect(page.getByTestId('chatbot-edit-details-modal')).toBeVisible()
    await page
      .getByTestId('chatbot-description')
      .fill('Published chatbot metadata remains editable.')
    await page.getByTestId('chatbot-edit-details-save').click()
    await expect(page.getByTestId('chatbot-edit-details-modal')).toHaveCount(0)
  })

  test('revises published credits without changing live policy until approval', async ({
    page,
  }) => {
    await setPublishingAuthorization(true)
    const chatbot = await seedPublicationChatbot({
      name: `${CHATBOT_PREFIX} Revision`,
      status: 'PUBLISHED',
      withDisclaimer: true,
    })
    await page.goto(
      `${process.env.URL_MANAGE ?? URL_MANAGE}/resources/chatbots?chatbotId=${chatbot.id}&view=usage`
    )
    await openSection(page, 'usage')
    await page.getByTestId('chatbot-credit-initial').fill('25')
    await page.getByTestId('chatbot-credit-reset-amount').fill('15')
    await saveSection(page, 'usage')
    const prisma = await getPrisma()
    await expect
      .poll(async () => {
        const saved = await prisma.chatbot.findUniqueOrThrow({
          where: { id: chatbot.id },
        })
        return saved.draftConfig?.creditInitialCredits
      })
      .toBe(25)
    const live = await prisma.chatbot.findUniqueOrThrow({
      where: { id: chatbot.id },
    })
    expect(live).toMatchObject({
      status: 'PUBLISHED',
      creditInitialCredits: 10,
      creditResetAmount: 10,
    })
    await page.reload()
    await openSection(page, 'usage')
    await expect(page.getByTestId('chatbot-credit-initial')).toHaveValue('25')
    await expect(page.getByTestId('chatbot-live-credit-policy')).toBeVisible()
    await expect(page.getByTestId('chatbot-unsubmitted-sections')).toBeVisible()
    const originalDisclaimerId = live.disclaimerId
    for (const title of [
      'First revised disclaimer',
      'Second revised disclaimer',
    ]) {
      await openSection(page, 'students')
      await page.getByTestId('chatbot-disclaimer-title').fill(title)
      await saveSection(page, 'students')
      await expect
        .poll(async () => {
          const saved = await prisma.chatbot.findUniqueOrThrow({
            where: { id: chatbot.id },
          })
          return {
            liveDisclaimerId: saved.disclaimerId,
            draftTitle: saved.draftConfig?.disclaimerTitle,
          }
        })
        .toEqual({ liveDisclaimerId: originalDisclaimerId, draftTitle: title })
    }
    await fillPublicationRequest(page, 'Revised synthetic study support.')
    await page.getByTestId('request-chatbot-publication').click()
    await expect
      .poll(async () => {
        const pending = await prisma.chatbot.findUniqueOrThrow({
          where: { id: chatbot.id },
        })
        return pending.revisionStatus
      })
      .toBe('PENDING_APPROVAL')
    await openSection(page, 'usage')
    await expect(page.getByTestId('chatbot-credit-initial')).toBeDisabled()
    const pending = await prisma.chatbot.findUniqueOrThrow({
      where: { id: chatbot.id },
    })
    expect(pending).toMatchObject({
      status: 'PUBLISHED',
      creditInitialCredits: 10,
      creditResetAmount: 10,
    })
    // The approved version keeps serving students while the revision waits.
    await expect(
      page.getByTestId('chatbot-publication-visibility-note')
    ).toHaveAttribute('data-published', 'true')
    await page.getByTestId('withdraw-chatbot-revision').click()
    await expect
      .poll(async () => {
        const withdrawn = await prisma.chatbot.findUniqueOrThrow({
          where: { id: chatbot.id },
        })
        return withdrawn.revisionStatus
      })
      .toBe('DRAFT')
    await expect(page.getByTestId('chatbot-credit-initial')).toHaveValue('25')
    await page.getByTestId('chatbot-credit-initial').fill('30')
    await saveSection(page, 'usage')
    await expect
      .poll(async () => {
        const saved = await prisma.chatbot.findUniqueOrThrow({
          where: { id: chatbot.id },
        })
        return saved.draftConfig?.creditInitialCredits
      })
      .toBe(30)
    await fillPublicationRequest(page, 'Revised synthetic study support.')
    await page.getByTestId('request-chatbot-publication').click()
    await expect
      .poll(async () => {
        const resubmitted = await prisma.chatbot.findUniqueOrThrow({
          where: { id: chatbot.id },
        })
        return resubmitted.revisionStatus
      })
      .toBe('PENDING_APPROVAL')
    const resubmitted = await prisma.chatbot.findUniqueOrThrow({
      where: { id: chatbot.id },
    })
    expect(resubmitted.revisionVersion).toBeGreaterThan(pending.revisionVersion)
    await approveRevision(page, chatbot.id, resubmitted.revisionVersion)
    const approved = await prisma.chatbot.findUniqueOrThrow({
      where: { id: chatbot.id },
    })
    expect(approved).toMatchObject({
      status: 'PUBLISHED',
      creditInitialCredits: 30,
      creditResetAmount: 15,
      draftConfig: null,
      revisionStatus: null,
    })
    expect(approved.publishedAt).toEqual(chatbot.publishedAt)
    await page.reload()
    await openSection(page, 'usage')
    await expect(page.getByTestId('chatbot-credit-initial')).toHaveValue('30')
    await expect(page.getByTestId('chatbot-credit-initial')).toBeEnabled()
  })

  test('shows the full read-only preview and publication details for a paused chatbot', async ({
    page,
  }) => {
    await seedPublicationChatbot({
      name: `${CHATBOT_PREFIX} Paused`,
      status: 'PAUSED',
      withDisclaimer: true,
    })
    await page.reload()

    await expect(page.getByTestId('chatbot-paused-notice')).toBeVisible()
    await expect(page.getByTestId('chatbot-usage-strip')).toBeVisible()
    await page.getByTestId('chatbot-section-students-preview').click()
    const pausedPreview = page
      .getByTestId('chatbot-students-preview-modal')
      .getByTestId('chatbot-disclaimer-preview')
    await expect(pausedPreview).toContainText('Synthetic chatbot disclaimer')
    await expect(pausedPreview).toContainText(
      'Synthetic disclaimer text for this test chatbot.'
    )
    await expect(pausedPreview).toContainText('Student Responsibility')
    await expect(pausedPreview).toContainText('Data Protection')
    await page.keyboard.press('Escape')
    // Settings stay locked while paused: no request card and no save buttons.
    await expect(page.getByTestId('chatbot-section-request')).toHaveCount(0)
    await openSection(page, 'usage')
    await expect(page.getByTestId('chatbot-section-usage-save')).toHaveCount(0)
  })

  test('shows a rejection comment and allows correction and resubmission', async ({
    page,
  }) => {
    await setPublishingAuthorization(true)
    await seedPublicationChatbot({
      name: `${CHATBOT_PREFIX} Rejected`,
      status: 'REJECTED',
      withDisclaimer: true,
      reviewComment: 'Clarify the intended student audience.',
    })
    await page.reload()

    await expect(page.getByTestId('chatbot-setup-review')).toBeVisible()
    await expect(page.getByTestId('chatbot-changes-requested')).toBeVisible()
    await expect(
      page.getByText('Clarify the intended student audience.')
    ).toBeVisible()
    await expect(page.getByTestId('request-chatbot-publication')).toHaveText(
      'Resubmit for approval'
    )

    await fillPublicationRequest(page, 'Corrected synthetic study support.')
    await page.getByTestId('request-chatbot-publication').click()

    await expect(
      page.getByTestId('chatbot-details').getByTestId('chatbot-status')
    ).toHaveText('Pending approval')
    await expect(page.getByTestId('chatbot-publication-readonly')).toBeVisible()
  })

  test('withholds chatbot authoring without the AI approval', async ({
    page,
  }) => {
    await setPublishingAuthorization(false)
    await seedPublicationChatbot({
      name: `${CHATBOT_PREFIX} Unauthorized`,
      status: 'DRAFT',
      withDisclaimer: true,
    })
    await page.reload()

    await expect(
      page.getByTestId('chatbot-authoring-unavailable')
    ).toBeVisible()
    await expect(page.getByTestId('create-chatbot')).not.toBeAttached()
  })

  test('blocks submission for a linked but incomplete disclaimer', async ({
    page,
  }) => {
    await setPublishingAuthorization(true)
    await seedPublicationChatbot({
      name: `${CHATBOT_PREFIX} Blank Disclaimer`,
      status: 'DRAFT',
      withDisclaimer: true,
      incompleteDisclaimer: true,
    })
    await page.reload()

    // The linked disclaimer exists but its normalized content is empty, so
    // the publication request remains unavailable until the section is fixed.
    await expect(page.getByTestId('chatbot-section-students')).toHaveAttribute(
      'data-status',
      'invalid'
    )
    await expect(
      page.getByTestId('chatbot-publication-blocker-students')
    ).toBeVisible()
    await expect(page.getByTestId('request-chatbot-publication')).toBeDisabled()
    await openSection(page, 'students')
    // Saving needs an edit; a different whitespace-only title is still empty.
    await page.getByTestId('chatbot-disclaimer-title').fill('  ')
    await page.getByTestId('chatbot-section-students-save').click()
    await expect(page.getByTestId('chatbot-disclaimer-title')).toHaveAttribute(
      'aria-invalid',
      'true'
    )
    await expect(page.getByTestId('chatbot-disclaimer-title')).toBeFocused()

    const chatbotId = new URL(page.url()).searchParams.get('chatbotId')
    await page.goto(
      `${process.env.URL_MANAGE ?? URL_MANAGE}/resources/chatbots?chatbotId=${chatbotId}&view=setup&step=review`
    )
    await expect(page.getByTestId('chatbot-setup-review')).toBeVisible()
    await expect
      .poll(() => new URL(page.url()).searchParams.get('step'))
      .toBe('review')
    await expect(page.getByTestId('chatbot-publication-use-case')).toBeVisible()
    await expect(
      page.getByTestId('chatbot-publication-blocker-students')
    ).toBeVisible()
    await expect(page.getByTestId('request-chatbot-publication')).toBeDisabled()
  })
})
