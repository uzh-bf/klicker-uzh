import { expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { Prisma } from '@klicker-uzh/prisma/client'
import { getPrisma } from '../global-setup.js'
import { test } from '../util/fixtures.js'
import { selectOption } from '../util/fixtures/activities.js'
import { fillEditorField } from '../util/fixtures/elements.js'
import { mockGrowthBookFeatureFlags } from '../util/fixtures/manage.js'
import {
  COURSE_ID_TEST,
  URL_CHAT,
  URL_MANAGE,
  USER_ID_TEST,
} from '../util/constants.js'

const CHATBOT_PREFIX = 'E2E Authoring'
const FIRST_CHATBOT = `${CHATBOT_PREFIX} One`
const SECOND_CHATBOT = `${CHATBOT_PREFIX} Two`
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

  await prisma.chatbotDisclaimer.deleteMany({
    where: { name: { startsWith: CHATBOT_PREFIX } },
  })

  await prisma.user.update({
    where: { id: USER_ID_TEST },
    data: { aiFeaturesEnabled: false },
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
  await expect(page.getByTestId('chatbot-setup-disclaimer')).toBeVisible()
  await expect(page.getByTestId('chatbot-disclaimer-title')).not.toHaveValue('')
  await expect(
    page.getByTestId('chatbot-disclaimer-suggested-unsaved')
  ).toBeVisible()
  await expect(page.getByTestId('save-chatbot-disclaimer')).toBeEnabled()

  const chatbotId = new URL(page.url()).searchParams.get('chatbotId')
  expect(chatbotId).toBeTruthy()
  return chatbotId as string
}

async function navigateToSetupStep(
  page: Parameters<typeof fillEditorField>[0],
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
  if (step === 'credits') {
    await expect(page.getByTestId('chatbot-credit-policy-form')).toBeVisible()
  } else {
    await expect(
      page.getByTestId(`chatbot-setup-trigger-${step}`)
    ).toBeVisible()
    await expect(page.getByTestId(`chatbot-setup-${step}`)).toBeVisible()
  }
}

async function expectSetupTriggers(page: Page) {
  for (const view of [
    'overview',
    'knowledge',
    'behavior',
    'disclaimer',
    'usage',
  ]) {
    await expect(page.getByTestId(`chatbot-view-${view}`)).toBeVisible()
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
  const persisted = JSON.parse(
    await readFile(
      new URL('../../packages/graphql/src/public/client.json', import.meta.url),
      'utf8'
    )
  ) as Record<string, string>
  // GraphQL is served by the API app, not by the manage frontend origin.
  // The API derives the JWT from a cookie only when the request origin
  // matches a known app subdomain, so send the session token from the
  // browser context's cookie jar as a Bearer token instead.
  const apiOrigin = process.env.APP_ORIGIN_API ?? 'http://127.0.0.1:3000'
  const sessionToken = (await page.context().cookies()).find(
    (cookie) => cookie.name === 'next-auth.session-token'
  )?.value
  if (!sessionToken) throw new Error('No lecturer session token in context')
  const response = await page.request.post(`${apiOrigin}/api/graphql`, {
    headers: {
      'x-graphql-yoga-csrf': 'true',
      authorization: `Bearer ${sessionToken}`,
    },
    data: {
      operationName: 'MApproveChatbotRevision',
      variables: { id, expectedRevisionVersion: version },
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash: persisted.MApproveChatbotRevision,
        },
      },
    },
  })
  expect(response.ok()).toBeTruthy()
  const result = await response.json()
  expect(result.errors).toBeUndefined()
  expect(result.data.approveChatbotRevision).toMatchObject({
    id,
    status: 'PUBLISHED',
    revisionStatus: null,
    authoringRevision: null,
  })
}

async function fillPublicationRequest(page: Page, useCase: string) {
  await page.getByTestId('chatbot-publication-use-case').fill(useCase)
  await page
    .getByTestId('chatbot-publication-expected-student-count')
    .fill('40')
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

  test('opens a draft owner preview with its effective modes', async ({
    page,
  }) => {
    const chatbotId = await createChatbot(page, FIRST_CHATBOT)
    const previewPagePromise = page.context().waitForEvent('page')
    const previewDialogPromise = page.waitForEvent('dialog')
    const previewClickPromise = page
      .getByTestId('chatbot-owner-preview-link')
      .click()
    const previewDialog = await previewDialogPromise
    expect(previewDialog.type()).toBe('confirm')
    await previewDialog.accept()

    await previewClickPromise
    const previewPage = await previewPagePromise

    await expect(previewPage).toHaveURL(
      `${process.env.URL_CHAT ?? URL_CHAT}/preview/${chatbotId}`
    )
    await expect(previewPage.getByTestId('chat-error')).toHaveCount(0)
    await expect(previewPage.getByTestId('chat-welcome-message')).toBeVisible()
    await expect(previewPage.getByTestId('chat-welcome-mode')).toContainText(
      'Tutor'
    )
  })

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

    await expect(page.getByTestId('chatbot-disclaimer-title')).toHaveValue(
      'Unsaved title'
    )

    const discardNavigationDialogPromise = page
      .waitForEvent('dialog')
      .then((dialog) => {
        expect(dialog.type()).toBe('confirm')
        return dialog.accept()
      })
    await page.getByTestId('chatbot-view-knowledge').click()
    await discardNavigationDialogPromise
    await expect(page.getByTestId('chatbot-knowledge')).toBeVisible()

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
    await expect(page.getByTestId('chatbot-setup-progress')).toHaveCount(0)
    await expect(page.getByTestId('chatbot-setup-back')).toHaveCount(0)
    await expect.poll(() => createOperationCount).toBe(1)
    await expect
      .poll(() => new URL(page.url()).searchParams.get('view'))
      .toBe('disclaimer')
    await expect
      .poll(() => new URL(page.url()).searchParams.get('step'))
      .toBeNull()
    await expect(
      page.getByTestId('chatbot-disclaimer-suggested-unsaved')
    ).toBeVisible()

    const chatbotId = new URL(page.url()).searchParams.get('chatbotId')
    page.once('dialog', (dialog) => {
      expect(dialog.type()).toBe('beforeunload')
      void dialog.accept()
    })
    await page.goto(
      `${process.env.URL_MANAGE ?? URL_MANAGE}/resources/chatbots?chatbotId=${chatbotId}&view=invalid&step=invalid`
    )
    await expect
      .poll(() => new URL(page.url()).searchParams.get('view'))
      .toBe('disclaimer')
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
    await navigateToSetupStep(page, 'basics')

    await page
      .getByTestId('chatbot-description')
      .fill('Updated persisted description')
    await page.getByTestId('save-chatbot-metadata').click()
    await expect(page.getByTestId('chatbot-name')).toBeDisabled()
    await expect(page.getByTestId('chatbot-description')).toBeDisabled()
    metadataRequestGate.release()
    await expect(page.getByTestId('chatbot-name')).toBeEnabled()
    await page.getByTestId('chatbot-view-disclaimer').click()
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
    await page.getByTestId('chatbot-setup-trigger-disclaimer').click()
    await expect(page.getByTestId('chatbot-setup-disclaimer')).not.toBeVisible()
    await page.getByTestId('chatbot-setup-trigger-disclaimer').click()
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
    const preview = page.getByTestId('chatbot-disclaimer-preview')
    await expect(preview).toContainText('Course chatbot conditions')
    await expect(preview).toContainText('Use this chatbot as a learning aid.')
    await expect(preview).toContainText('Student Responsibility')
    await expect(preview).toContainText('Data Protection')
    await expect(
      page.getByTestId('chatbot-disclaimer-consequences')
    ).toContainText('Accept: You can use the chatbot')

    await page.getByTestId('save-chatbot-disclaimer').click()
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
    await page.getByTestId('chatbot-view-behavior').click()
    await pendingNavigationAlertPromise
    await expect.poll(() => page.url()).toBe(pendingDisclaimerUrl)
    disclaimerRequestGate.release()
    await expect(page.getByTestId('chatbot-disclaimer-title')).toBeEnabled()
    await navigateToSetupStep(page, 'review')
    await expect(page.getByTestId('chatbot-review-name')).toHaveText(
      FIRST_CHATBOT
    )

    await navigateToSetupStep(page, 'modes')
    await expect(page.getByTestId('chatbot-mode-switch-tutor')).toBeChecked()
    await expect(
      page.getByTestId('chatbot-mode-switch-explainer')
    ).toBeChecked()
    await expect(page.getByTestId('chatbot-mode-switch-quizzer')).toBeChecked()
    const framingField = page.getByTestId('chatbot-framing')
    await expect(framingField).toHaveAttribute('maxlength', '200')
    await framingField.fill(
      'Focus on the course materials and applied examples.'
    )
    await page.getByTestId('chatbot-mode-switch-tutor').click()
    await expect(
      page.getByTestId('chatbot-mode-switch-explainer')
    ).toBeDisabled()
    await page.getByTestId('chatbot-mode-switch-tutor').click()
    await page.getByTestId('chatbot-mode-switch-explainer').click()
    await page.getByTestId('chatbot-mode-switch-quizzer').click()
    await page.getByTestId('save-chatbot-modes').click()
    await expect(page.getByTestId('save-chatbot-modes')).toBeDisabled()
    await expect(page.getByTestId('chatbot-mode-switch-tutor')).toBeDisabled()
    await expect(
      page.getByTestId('chatbot-mode-switch-explainer')
    ).toBeDisabled()
    await expect(page.getByTestId('chatbot-mode-switch-quizzer')).toBeDisabled()
    await expect(
      page.getByTestId('chatbot-mode-capability-note')
    ).toContainText('Quizzer may still be hidden')
    await expect
      .poll(() => modeConfigVariables)
      .toMatchObject({
        tutorEnabled: true,
        explainerEnabled: false,
        quizzerEnabled: false,
        courseName: null,
        subjectDomain: null,
        languageOfInstruction: null,
        scopeNote: 'Focus on the course materials and applied examples.',
      })
    modeRequestGate.release()
    await expect(page.getByText('Learning modes saved.')).toBeVisible()

    await navigateToSetupStep(page, 'review')
    await expect(page.getByTestId('chatbot-review-modes')).toBeVisible()
    await expect(page.getByTestId('chatbot-review-mode-tutor')).toHaveText(
      'Enabled'
    )
    await expect(page.getByTestId('chatbot-review-mode-explainer')).toHaveText(
      'Disabled'
    )
    await expect(page.getByTestId('chatbot-review-mode-quizzer')).toHaveText(
      'Disabled'
    )
    await expect(page.getByTestId('chatbot-review-framing')).toHaveText(
      'Focus on the course materials and applied examples.'
    )
    await page.getByTestId('chatbot-setup-edit-modes').click()
    await expect(page.getByTestId('chatbot-setup-modes')).toBeVisible()

    await page.getByTestId('chatbot-view-overview').click()
    await page.getByTestId('chatbot-setup-trigger-review').click()
    await page.getByTestId('chatbot-setup-edit-basics').click()
    await expect(page.getByTestId('chatbot-setup-basics')).toBeVisible()
    await expect(page.getByTestId('chatbot-setup-review')).toBeVisible()
    await page.getByTestId('chatbot-setup-edit-disclaimer').click()
    await expect(page.getByTestId('chatbot-setup-disclaimer')).toBeVisible()

    await page.getByTestId('chatbot-view-behavior').click()
    await expect(page.getByTestId('chatbot-view-behavior')).toHaveAttribute(
      'aria-current',
      'page'
    )
    await expect(
      page.getByTestId('chatbot-model-selection-switch')
    ).not.toBeChecked()
    await expect(page.getByTestId('chatbot-fixed-model')).toContainText(
      'Auto Mode'
    )
    await expect(
      page.getByTestId('chatbot-reasoning-gpt-5.6-luna')
    ).toHaveCount(0)
    await selectOption(page, '[data-cy="chatbot-fixed-model"]', 'GPT-5.6 Luna')
    await selectOption(
      page,
      '[data-cy="chatbot-reasoning-gpt-5.6-luna"]',
      'high'
    )
    await page.getByTestId('chatbot-model-selection-switch').click()
    await expect(page.getByTestId('chatbot-model-gpt-5.6-luna')).toBeChecked()
    await expect(
      page.getByTestId('chatbot-reasoning-gpt-5.6-luna-high')
    ).toBeChecked()
    await page.getByTestId('chatbot-model-auto').click()
    const advancedUrl = page.url()
    const historyDiscardDialogPromise = page
      .waitForEvent('dialog')
      .then((dialog) => {
        expect(dialog.message()).toBe('Discard your unsaved chatbot changes?')
        return dialog.dismiss()
      })
    await page.evaluate(() => window.history.back())
    await historyDiscardDialogPromise
    await expect.poll(() => page.url()).toBe(advancedUrl)
    await expect(page.getByTestId('chatbot-view-behavior')).toHaveAttribute(
      'aria-current',
      'page'
    )

    await page.getByTestId('chatbot-view-behavior').click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    const createDiscardDialogPromise = page
      .waitForEvent('dialog')
      .then((dialog) => {
        expect(dialog.message()).toBe('Discard your unsaved chatbot changes?')
        return dialog.dismiss()
      })
    await page.getByTestId('create-chatbot').click()
    await createDiscardDialogPromise
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByTestId('chatbot-view-behavior')).toHaveAttribute(
      'aria-current',
      'page'
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
    const discardDialogPromise = page.waitForEvent('dialog').then((dialog) => {
      expect(dialog.message()).toBe('Discard your unsaved chatbot changes?')
      return dialog.dismiss()
    })
    await page.getByTestId('chatbot-view-usage').click()
    await discardDialogPromise
    await expect(page.getByTestId('chatbot-view-behavior')).toHaveAttribute(
      'aria-current',
      'page'
    )
    await page.getByTestId('chatbot-model-settings-save').click()
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
      page.getByTestId('chatbot-reasoning-gpt-5.6-luna-high')
    ).toBeDisabled()
    await expect
      .poll(() => modelPolicyVariables)
      .toMatchObject({
        modelSelection: true,
        allowedModelIds: ['auto', 'gpt-5.6-luna'],
        allowedReasoningEffortsByModel: [
          { modelId: 'gpt-5.6-luna', efforts: ['high'] },
        ],
      })
    modelSettingsRequestGate.release()
    await expect(page.getByText('Model settings saved.')).toBeVisible()

    await page.getByTestId('chatbot-view-usage').click()
    await expect(page.getByText('Credits', { exact: true })).toBeVisible()
    await expect(page.getByText('Usage Summary', { exact: true })).toBeVisible()

    await createChatbot(page, SECOND_CHATBOT)
    await expect(page.getByTestId('chatbot-disclaimer-title')).not.toHaveValue(
      ''
    )
    await expect(page.getByTestId('chatbot-setup-disclaimer')).toBeVisible()

    await page.setViewportSize({ width: 800, height: 900 })
    const secondChatbotDiscardDialogPromise = page
      .waitForEvent('dialog')
      .then((dialog) => {
        expect(dialog.type()).toBe('confirm')
        return dialog.accept()
      })
    await selectOption(
      page,
      '[data-cy="chatbot-mobile-selector"]',
      `${FIRST_CHATBOT} · Draft`
    )
    await secondChatbotDiscardDialogPromise
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
    await expect(page.getByTestId('chatbot-setup-basics')).not.toBeVisible()
    await expect(page.getByTestId('chatbot-setup-disclaimer')).not.toBeVisible()

    await page.reload()
    await expect(page.getByTestId('chatbot-setup-review')).toBeVisible()
    await navigateToSetupStep(page, 'modes')
    await expect(page.getByTestId('chatbot-mode-switch-tutor')).toBeChecked()
    await expect(page.getByTestId('chatbot-framing')).toHaveValue(
      'Focus on the course materials and applied examples.'
    )
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
    await page.getByTestId('save-chatbot-modes').click()
    await expect
      .poll(() => modeConfigVariables)
      .toMatchObject({
        tutorEnabled: true,
        explainerEnabled: true,
        quizzerEnabled: false,
        scopeNote: legacyScopeNote,
      })
    await expect(page.getByText('Learning modes saved.')).toBeVisible()
    await page.reload()
    await navigateToSetupStep(page, 'modes')
    await expect(page.getByTestId('chatbot-framing')).toHaveValue(
      legacyScopeNote
    )
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

  test('submits a complete draft and locks publication details while pending', async ({
    page,
  }) => {
    await setPublishingAuthorization(true)
    await page.reload()
    await createChatbot(page, `${CHATBOT_PREFIX} Publication`)

    await page
      .getByTestId('chatbot-disclaimer-title')
      .fill('Synthetic publication disclaimer')
    await fillEditorField(
      page,
      'chatbot-disclaimer-intro',
      'Synthetic disclaimer content for publication.'
    )
    await page.getByTestId('save-chatbot-disclaimer').click()
    await expect(page.getByTestId('chatbot-disclaimer-title')).toBeEnabled()
    await page.getByTestId('chatbot-view-overview').click()
    await page.getByTestId('chatbot-setup-trigger-review').click()
    await expect(page.getByTestId('chatbot-setup-review')).toBeVisible()

    await navigateToSetupStep(page, 'credits')
    await page.getByTestId('chatbot-credit-initial').fill('25')
    await page.getByTestId('chatbot-credit-reset-amount').fill('15')
    await page.getByTestId('chatbot-credit-maximum').fill('100')
    await page.getByTestId('save-chatbot-credit-policy').click()
    await expect(page.getByTestId('save-chatbot-credit-policy')).toBeDisabled()
    await navigateToSetupStep(page, 'review')

    await fillPublicationRequest(
      page,
      'Support students with a synthetic study aid.'
    )
    const submitButton = page.getByTestId('request-chatbot-publication')
    await expect(submitButton).toBeEnabled()

    await page.getByTestId('chatbot-setup-edit-basics').click()
    await expect(page.getByTestId('chatbot-setup-basics')).toBeVisible()
    await page
      .getByTestId('chatbot-description')
      .fill('Unsaved metadata must block publication.')
    await expect(submitButton).toBeDisabled()
    await expect(
      page.getByTestId('chatbot-publication-unsaved-setup')
    ).toBeVisible()

    const metadataSaveGate = createRequestGate()
    await page.route('**/api/graphql', async (route) => {
      const request = route.request()
      if (
        request.postDataJSON()?.operationName !== 'MSaveChatbotRevision' ||
        !request.postDataJSON()?.variables?.input?.metadata
      ) {
        await route.continue()
        return
      }

      const response = await route.fetch()
      await metadataSaveGate.wait
      await route.fulfill({ response })
    })
    await page.getByTestId('save-chatbot-metadata').click()
    await expect(submitButton).toBeDisabled()
    metadataSaveGate.release()
    await expect(submitButton).toBeEnabled()

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
    await expect(page.getByTestId('chatbot-name')).toBeDisabled()
    await expect(page.getByTestId('save-chatbot-metadata')).toBeDisabled()
    await expect(
      page.getByTestId('chatbot-publication-use-case')
    ).toBeDisabled()
    await expect(
      page.getByTestId('chatbot-publication-expected-student-count')
    ).toBeDisabled()
    const pendingNavigationUrl = page.url()
    const pendingNavigationAlertPromise = page
      .waitForEvent('dialog')
      .then((dialog) => {
        expect(dialog.type()).toBe('alert')
        return dialog.dismiss()
      })
    await page.getByTestId('chatbot-view-disclaimer').click()
    await pendingNavigationAlertPromise
    await expect.poll(() => page.url()).toBe(pendingNavigationUrl)

    publicationRequestGate.release()
    await expect(
      page.getByTestId('chatbot-details').getByTestId('chatbot-status')
    ).toHaveText('Pending approval')
    await expect(
      page.getByTestId('chatbot-publication-readonly')
    ).toContainText('awaiting publication review')
    await expect(page.getByTestId('chatbot-view-behavior')).toHaveCount(1)
    await expect(page.getByTestId('chatbot-view-overview')).toHaveAttribute(
      'aria-current',
      'page'
    )
    await expect(page.getByTestId('chatbot-disclaimer-preview')).toContainText(
      'Synthetic publication disclaimer'
    )
    await expect(page.getByTestId('chatbot-disclaimer-preview')).toContainText(
      'Student Responsibility'
    )
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
      creditResetPeriod: 'WEEKLY',
      creditResetAmount: 15,
      creditMaxCredits: 100,
    })

    if (!chatbot) throw new Error('Expected the publication chatbot to exist')
    await approveRevision(page, chatbot.id, chatbot.revisionVersion)
    await page.goto(
      `${process.env.URL_MANAGE ?? URL_MANAGE}/resources/chatbots?chatbotId=${chatbot.id}`
    )
    await expect(page.getByTestId('chatbot-overview')).toBeVisible()
    const publishedPreview = page.getByTestId('chatbot-disclaimer-preview')
    await expect(publishedPreview).toContainText(
      'Synthetic publication disclaimer'
    )
    await expect(publishedPreview).toContainText(
      'Synthetic disclaimer content for publication.'
    )
    await expect(publishedPreview).toContainText('Student Responsibility')
    await expect(publishedPreview).toContainText('Data Protection')
    await expect(
      page.getByTestId('chatbot-publication-readonly')
    ).toContainText('Support students with a synthetic study aid.')
    await navigateToSetupStep(page, 'review')
    await expect
      .poll(() => new URL(page.url()).searchParams.get('step'))
      .toBe('review')
    await expect(page.getByTestId('chatbot-setup-review')).toBeVisible()
    await page.getByTestId('chatbot-setup-edit-basics').click()
    await expect(page.getByTestId('chatbot-setup-basics')).toBeVisible()
    await page
      .getByTestId('chatbot-description')
      .fill('Published chatbot metadata remains editable.')
    await page.getByTestId('save-chatbot-metadata').click()
    await expect(
      page.getByRole('status').filter({ hasText: 'Chatbot metadata saved.' })
    ).toBeVisible()
    await expect(page.getByTestId('chatbot-setup-basics')).toBeVisible()
    await page
      .getByTestId('chatbot-description')
      .fill('Published chatbot metadata edited again.')
    await expect(
      page.getByRole('status').filter({ hasText: 'Chatbot metadata saved.' })
    ).toHaveCount(0)
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
    await page.getByTestId('chatbot-credit-initial').fill('25')
    await page.getByTestId('chatbot-credit-reset-amount').fill('15')
    await page.getByTestId('save-chatbot-credit-policy').click()
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
    await expect(page.getByTestId('chatbot-credit-initial')).toHaveValue('25')
    await navigateToSetupStep(page, 'review')
    await page.getByTestId('chatbot-setup-edit-credits').click()
    await expect(page.getByTestId('chatbot-credit-policy-form')).toBeVisible()
    await navigateToSetupStep(page, 'disclaimer')
    const originalDisclaimerId = live.disclaimerId
    for (const title of [
      'First revised disclaimer',
      'Second revised disclaimer',
    ]) {
      await page.getByTestId('chatbot-disclaimer-title').fill(title)
      await page.getByTestId('save-chatbot-disclaimer').click()
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
    await navigateToSetupStep(page, 'review')
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
    await navigateToSetupStep(page, 'credits')
    await expect(page.getByTestId('chatbot-credit-initial')).toBeDisabled()
    const pending = await prisma.chatbot.findUniqueOrThrow({
      where: { id: chatbot.id },
    })
    expect(pending).toMatchObject({
      status: 'PUBLISHED',
      creditInitialCredits: 10,
      creditResetAmount: 10,
    })
    await navigateToSetupStep(page, 'review')
    await page.getByTestId('withdraw-chatbot-revision').click()
    await expect
      .poll(async () => {
        const withdrawn = await prisma.chatbot.findUniqueOrThrow({
          where: { id: chatbot.id },
        })
        return withdrawn.revisionStatus
      })
      .toBe('DRAFT')
    await navigateToSetupStep(page, 'credits')
    await expect(page.getByTestId('chatbot-credit-initial')).toHaveValue('25')
    await page.getByTestId('chatbot-credit-initial').fill('30')
    await page.getByTestId('save-chatbot-credit-policy').click()
    await expect
      .poll(async () => {
        const saved = await prisma.chatbot.findUniqueOrThrow({
          where: { id: chatbot.id },
        })
        return saved.draftConfig?.creditInitialCredits
      })
      .toBe(30)
    await navigateToSetupStep(page, 'review')
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

    await expect(page.getByTestId('chatbot-overview')).toBeVisible()
    const pausedPreview = page.getByTestId('chatbot-disclaimer-preview')
    await expect(pausedPreview).toContainText('Synthetic chatbot disclaimer')
    await expect(pausedPreview).toContainText(
      'Synthetic disclaimer text for this test chatbot.'
    )
    await expect(pausedPreview).toContainText('Student Responsibility')
    await expect(pausedPreview).toContainText('Data Protection')
    await expect(
      page.getByTestId('chatbot-publication-readonly')
    ).toContainText('Initial synthetic use case')
    await expect(page.getByTestId('chatbot-view-behavior')).toHaveCount(1)
    await expect(page.getByTestId('chatbot-view-overview')).toHaveAttribute(
      'aria-current',
      'page'
    )
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

  test('keeps an unauthorized draft available for preparation', async ({
    page,
  }) => {
    await setPublishingAuthorization(false)
    await seedPublicationChatbot({
      name: `${CHATBOT_PREFIX} Unauthorized`,
      status: 'DRAFT',
      withDisclaimer: true,
    })
    await page.reload()

    await expect(page.getByTestId('chatbot-setup-review')).toBeVisible()
    await expect(page.getByTestId('chatbot-publication-use-case')).toBeVisible()
    await expect(page.getByTestId('request-chatbot-publication')).toBeDisabled()
    await expect(
      page.getByText(
        'This account is not approved to request chatbot publication.'
      )
    ).toBeVisible()
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
    await expect(page.getByTestId('chatbot-setup-disclaimer')).toBeVisible()
    await expect(page.getByTestId('save-chatbot-disclaimer')).toBeEnabled()
    await page.getByTestId('chatbot-view-overview').click()
    await expect(page.getByTestId('chatbot-setup-basics')).toBeVisible()
    await page.getByTestId('chatbot-name').fill('')
    await page.getByTestId('chatbot-setup-trigger-basics').click()
    await expect(page.getByTestId('chatbot-setup-basics')).not.toBeVisible()
    const discardDialogPromise = page.waitForEvent('dialog').then((dialog) => {
      expect(dialog.type()).toBe('confirm')
      return dialog.accept()
    })
    await page.getByTestId('chatbot-view-disclaimer').click()
    await discardDialogPromise
    await expect(page.getByTestId('chatbot-setup-disclaimer')).toBeVisible()
    await page.getByTestId('save-chatbot-disclaimer').click()
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
    await expect(page.getByTestId('request-chatbot-publication')).toBeDisabled()
  })
})
