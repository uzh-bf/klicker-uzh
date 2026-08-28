import { expect, type Page } from '@playwright/test'
import { getPrisma } from '../global-setup.js'
import { test } from '../util/fixtures.js'
import { selectOption } from '../util/fixtures/activities.js'
import { fillEditorField } from '../util/fixtures/elements.js'
import { COURSE_ID_TEST, URL_MANAGE, USER_ID_TEST } from '../util/constants.js'

const CHATBOT_PREFIX = 'E2E Authoring'
const FIRST_CHATBOT = `${CHATBOT_PREFIX} One`
const SECOND_CHATBOT = `${CHATBOT_PREFIX} Two`
type PublicationChatbotStatus = 'DRAFT' | 'REJECTED'

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
  await expect(page.getByTestId('chatbot-name')).toHaveValue(name)
  await expect(page.getByTestId('chatbot-course-readonly')).toHaveText(
    'Testkurs'
  )
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
        status === 'REJECTED' ? 'Initial synthetic use case' : undefined,
      expectedStudentCount: status === 'REJECTED' ? 20 : undefined,
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

    await page.route('**/api/graphql', async (route) => {
      const request = route.request()
      if (request.postDataJSON()?.operationName !== 'CreateChatbot') {
        await route.continue()
        return
      }

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
  })

  test('creates, edits, previews, switches, and reloads draft chatbots', async ({
    page,
  }) => {
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

    await page
      .getByTestId('chatbot-description')
      .fill('Updated persisted description')
    await page.getByTestId('save-chatbot-metadata').click()
    await expect(page.getByTestId('chatbot-name')).toBeDisabled()
    await expect(page.getByTestId('chatbot-description')).toBeDisabled()
    metadataRequestGate.release()
    await expect(
      page.getByRole('status').filter({ hasText: 'Chatbot metadata saved.' })
    ).toBeVisible()

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
    disclaimerRequestGate.release()
    await expect(
      page.getByRole('status').filter({ hasText: 'Chatbot disclaimer saved.' })
    ).toBeVisible()

    await page.getByTestId('chatbot-model-selection-switch').click()
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

    await createChatbot(page, SECOND_CHATBOT)
    await expect(page.getByTestId('chatbot-disclaimer-title')).toHaveValue('')
    await expect(
      page.getByTestId('chatbot-disclaimer-intro')
    ).not.toContainText('Use this chatbot as a learning aid.')

    await page.getByTestId(`chatbot-${FIRST_CHATBOT}`).click()
    await expect(page.getByTestId('chatbot-name')).toHaveValue(FIRST_CHATBOT)
    await expect(page.getByTestId('chatbot-description')).toHaveValue(
      'Updated persisted description'
    )
    await expect(page.getByTestId('chatbot-disclaimer-title')).toHaveValue(
      'Course chatbot conditions'
    )
    await expect(page.getByTestId('chatbot-disclaimer-intro')).toContainText(
      'Use this chatbot as a learning aid.'
    )
    await expect(
      page.getByTestId('chatbot-disclaimer-intro').locator('strong')
    ).toContainText('Verify important information.')

    await page.reload()
    await expect(page.getByTestId('chatbot-name')).toHaveValue(FIRST_CHATBOT)
    await expect(page.getByTestId('chatbot-description')).toHaveValue(
      'Updated persisted description'
    )
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
    await expect(
      page.getByRole('status').filter({ hasText: 'Chatbot disclaimer saved.' })
    ).toBeVisible()

    await fillPublicationRequest(
      page,
      'Support students with a synthetic study aid.'
    )
    const submitButton = page.getByTestId('request-chatbot-publication')
    await expect(submitButton).toBeEnabled()
    // While the mutation is in flight, all publication inputs lock with the
    // submit button so late edits cannot diverge from the submitted payload.
    await page.route('**/graphql', async (route) => {
      const request = route.request()
      if (
        request.postDataJSON()?.query?.includes('requestChatbotPublication')
      ) {
        await new Promise((resolve) => setTimeout(resolve, 3000))
        await route.continue()
      } else {
        await route.continue()
      }
    })
    await submitButton.click()
    await expect(submitButton).toBeDisabled()
    await expect(
      page.getByTestId('chatbot-publication-use-case')
    ).toBeDisabled()
    await expect(
      page.getByTestId('chatbot-publication-expected-student-count')
    ).toBeDisabled()
    await expect(
      page.getByTestId('chatbot-publication-proposed-credits')
    ).toBeDisabled()

    await expect(
      page.getByTestId('chatbot-details').getByTestId('chatbot-status')
    ).toHaveText('Pending approval')
    await expect(
      page.getByTestId('chatbot-publication-readonly')
    ).toContainText('awaiting publication review')
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

  test('keeps an incomplete unauthorized draft available for preparation', async ({
    page,
  }) => {
    await setPublishingAuthorization(false)
    await seedPublicationChatbot({
      name: `${CHATBOT_PREFIX} Incomplete`,
      status: 'DRAFT',
      withDisclaimer: false,
    })
    await page.reload()

    await expect(page.getByTestId('chatbot-publication-use-case')).toBeVisible()
    await expect(page.getByTestId('request-chatbot-publication')).toBeDisabled()
    await expect(
      page.getByText(
        'This account is not approved to request chatbot publication.'
      )
    ).toBeVisible()
    await expect(
      page.getByText(
        'Save a complete disclaimer before requesting publication.'
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
    // submission must stay disabled exactly as if no disclaimer were linked.
    await expect(page.getByTestId('chatbot-publication-use-case')).toBeVisible()
    await expect(page.getByTestId('request-chatbot-publication')).toBeDisabled()
    await expect(
      page.getByText(
        'Save a complete disclaimer before requesting publication.'
      )
    ).toBeVisible()
  })
})
