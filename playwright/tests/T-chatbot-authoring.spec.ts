import { expect, type Page } from '@playwright/test'
import { getPrisma } from '../global-setup.js'
import { test } from '../util/fixtures.js'
import { selectOption } from '../util/fixtures/activities.js'
import { fillEditorField } from '../util/fixtures/elements.js'
import { COURSE_ID_TEST, URL_MANAGE, USER_ID_TEST } from '../util/constants.js'

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
    data: { aiChatbotPublishingEnabled: false },
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
  await expect(page.getByTestId('chatbot-disclaimer-title')).toHaveValue('')

  const chatbotId = new URL(page.url()).searchParams.get('chatbotId')
  expect(chatbotId).toBeTruthy()
  return chatbotId as string
}

async function navigateToSetupStep(
  page: Parameters<typeof fillEditorField>[0],
  step: 'basics' | 'disclaimer' | 'review'
) {
  const url = new URL(page.url())
  url.searchParams.set('view', 'setup')
  url.searchParams.set('step', step)
  await page.goto(url.toString())
  await expect(page.getByTestId(`chatbot-setup-trigger-${step}`)).toBeVisible()
  await expect(page.getByTestId(`chatbot-setup-${step}`)).toBeVisible()
}

async function expectSetupTriggers(page: Page) {
  for (const section of ['basics', 'disclaimer', 'review']) {
    await expect(
      page.getByTestId(`chatbot-setup-trigger-${section}`)
    ).toBeVisible()
  }
}

async function setPublishingAuthorization(enabled: boolean) {
  const prisma = await getPrisma()
  await prisma.user.update({
    where: { id: USER_ID_TEST },
    data: { aiChatbotPublishingEnabled: enabled },
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
      disclaimerId: disclaimer?.id,
      publicationUseCase:
        status === 'DRAFT' ? undefined : 'Initial synthetic use case',
      expectedStudentCount: status === 'DRAFT' ? undefined : 20,
      creditInitialCredits: 10,
      reviewComment,
    },
  })
}

async function fillPublicationRequest(page: Page, useCase: string) {
  await page.getByTestId('chatbot-publication-use-case').fill(useCase)
  await page
    .getByTestId('chatbot-publication-expected-student-count')
    .fill('40')
  await page.getByTestId('chatbot-publication-proposed-credits').fill('25')
}

test.describe.serial('Lecturer chatbot draft authoring', () => {
  test.beforeEach(async ({ loginLecturer, page }) => {
    await cleanupAuthoringChatbots()
    await loginLecturer()
    await page.goto(
      `${process.env.URL_MANAGE ?? URL_MANAGE}/resources/chatbots`
    )
    await expect(page.getByTestId('create-chatbot')).toBeVisible()
  })

  test.afterEach(async () => {
    await cleanupAuthoringChatbots()
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
      .toBe('setup')
    await expect
      .poll(() => new URL(page.url()).searchParams.get('step'))
      .toBe('disclaimer')

    const chatbotId = new URL(page.url()).searchParams.get('chatbotId')
    await page.goto(
      `${process.env.URL_MANAGE ?? URL_MANAGE}/resources/chatbots?chatbotId=${chatbotId}&view=invalid&step=invalid`
    )
    await expect
      .poll(() => new URL(page.url()).searchParams.get('view'))
      .toBe('setup')
    await expect
      .poll(() => new URL(page.url()).searchParams.get('step'))
      .toBe('disclaimer')
  })

  test('creates, edits, previews, switches, and reloads draft chatbots', async ({
    page,
  }) => {
    test.slow()
    const metadataRequestGate = createRequestGate()
    const disclaimerRequestGate = createRequestGate()
    const modelSettingsRequestGate = createRequestGate()

    await page.route('**/api/graphql', async (route) => {
      const request = route.request()
      const postData = request.postData()
      const operationName = postData
        ? (JSON.parse(postData) as { operationName?: string }).operationName
        : undefined
      const requestGate =
        operationName === 'UpdateChatbotModelSettings'
          ? modelSettingsRequestGate
          : operationName === 'UpdateChatbot'
            ? metadataRequestGate
            : operationName === 'SaveChatbotDisclaimer'
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

    await createChatbot(page, FIRST_CHATBOT)
    await navigateToSetupStep(page, 'basics')

    await page
      .getByTestId('chatbot-description')
      .fill('Updated persisted description')
    await page.getByTestId('save-chatbot-metadata').click()
    await expect(page.getByTestId('chatbot-name')).toBeDisabled()
    await expect(page.getByTestId('chatbot-description')).toBeDisabled()
    metadataRequestGate.release()
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
    await page.getByTestId('chatbot-setup-trigger-review').click()
    await expect(page.getByTestId('chatbot-setup-review')).toBeVisible()
    await expect(page.getByTestId('chatbot-setup-basics')).toBeVisible()
    await expect(page.getByTestId('chatbot-disclaimer-title')).toBeDisabled()
    await expect.poll(() => page.url()).toBe(pendingDisclaimerUrl)
    disclaimerRequestGate.release()
    await expect(page.getByTestId('chatbot-setup-review')).toBeVisible()
    await expect(page.getByTestId('chatbot-review-name')).toHaveText(
      FIRST_CHATBOT
    )

    await page.getByTestId('chatbot-setup-edit-basics').click()
    await expect(page.getByTestId('chatbot-setup-basics')).toBeVisible()
    await expect(page.getByTestId('chatbot-setup-review')).toBeVisible()
    await page.getByTestId('chatbot-setup-edit-disclaimer').click()
    await expect(page.getByTestId('chatbot-setup-disclaimer')).toBeVisible()

    await page.getByTestId('chatbot-view-advanced').click()
    await expect(page.getByTestId('chatbot-view-advanced')).toHaveAttribute(
      'aria-current',
      'page'
    )
    await page.getByTestId('chatbot-model-selection-switch').click()
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
    await expect(page.getByTestId('chatbot-view-advanced')).toHaveAttribute(
      'aria-current',
      'page'
    )

    await page.getByTestId('chatbot-view-advanced').click()
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
    await expect(page.getByTestId('chatbot-view-advanced')).toHaveAttribute(
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
    await expect(page.getByTestId('chatbot-view-advanced')).toHaveAttribute(
      'aria-current',
      'page'
    )
    await page.getByTestId('chatbot-model-settings-save').click()
    await expect(
      page.getByTestId('chatbot-model-selection-switch')
    ).toBeDisabled()
    await expect(page.getByTestId('chatbot-models-all')).toBeDisabled()
    for (const input of await page
      .locator('input[data-cy^="chatbot-model-"]')
      .all()) {
      await expect(input).toBeDisabled()
    }
    modelSettingsRequestGate.release()
    await expect(page.getByText('Model settings saved.')).toBeVisible()

    await page.getByTestId('chatbot-view-usage').click()
    await expect(page.getByText('Credits', { exact: true })).toBeVisible()
    await expect(page.getByText('Usage Summary', { exact: true })).toBeVisible()

    await createChatbot(page, SECOND_CHATBOT)
    await expect(page.getByTestId('chatbot-disclaimer-title')).toHaveValue('')
    await expect(page.getByTestId('chatbot-setup-disclaimer')).toBeVisible()

    await page.setViewportSize({ width: 800, height: 900 })
    await selectOption(
      page,
      '[data-cy="chatbot-mobile-selector"]',
      `${FIRST_CHATBOT} · Draft`
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
    await expect(page.getByTestId('chatbot-setup-review')).toBeVisible()

    await fillPublicationRequest(
      page,
      'Support students with a synthetic study aid.'
    )
    const submitButton = page.getByTestId('request-chatbot-publication')
    await expect(submitButton).toBeEnabled()

    await page.getByTestId('chatbot-setup-trigger-basics').click()
    await page
      .getByTestId('chatbot-description')
      .fill('Unsaved metadata must block publication.')
    await expect(submitButton).toBeDisabled()
    await expect(
      page.getByText(
        'Save or wait for changes in Basics and Disclaimer before requesting publication.'
      )
    ).toBeVisible()

    const metadataSaveGate = createRequestGate()
    await page.route('**/api/graphql', async (route) => {
      const request = route.request()
      if (request.postDataJSON()?.operationName !== 'UpdateChatbot') {
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
      if (
        request.postDataJSON()?.operationName !== 'RequestChatbotPublication'
      ) {
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
    await expect(page.getByTestId('chatbot-disclaimer-title')).toBeDisabled()
    await expect(page.getByTestId('save-chatbot-disclaimer')).toBeDisabled()
    await expect(
      page.getByTestId('chatbot-publication-use-case')
    ).toBeDisabled()
    await expect(
      page.getByTestId('chatbot-publication-expected-student-count')
    ).toBeDisabled()
    await expect(
      page.getByTestId('chatbot-publication-proposed-credits')
    ).toBeDisabled()

    publicationRequestGate.release()
    await expect(
      page.getByTestId('chatbot-details').getByTestId('chatbot-status')
    ).toHaveText('Pending approval')
    await expect(
      page.getByTestId('chatbot-publication-readonly')
    ).toContainText('awaiting publication review')
    await expect(page.getByTestId('chatbot-view-setup')).toHaveCount(0)
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
    await expect(
      page.getByTestId('chatbot-publication-proposed-credits')
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
      },
    })
    expect(chatbot).toMatchObject({
      status: 'PENDING_APPROVAL',
      publicationUseCase: 'Support students with a synthetic study aid.',
      expectedStudentCount: 40,
      creditInitialCredits: 25,
    })

    if (!chatbot) throw new Error('Expected the publication chatbot to exist')
    await prisma.chatbot.update({
      where: { id: chatbot.id },
      data: { status: 'PUBLISHED' },
    })
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
    await page.getByTestId('chatbot-view-overview').click()
    await expect(page.getByTestId('chatbot-overview')).toBeVisible()
    await page.getByTestId('chatbot-view-setup').click()
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
    await expect(page.getByTestId('chatbot-view-setup')).toHaveCount(0)
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
    await page.getByTestId('chatbot-setup-trigger-basics').click()
    await page.getByTestId('chatbot-name').fill('')
    await page.getByTestId('chatbot-setup-trigger-basics').click()
    await expect(page.getByTestId('chatbot-setup-basics')).not.toBeVisible()
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
