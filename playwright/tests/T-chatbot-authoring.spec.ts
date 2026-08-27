import { expect } from '@playwright/test'
import { getPrisma } from '../global-setup.js'
import { test } from '../util/fixtures.js'
import { selectOption } from '../util/fixtures/activities.js'
import { fillEditorField } from '../util/fixtures/elements.js'
import { URL_MANAGE } from '../util/constants.js'

const CHATBOT_PREFIX = 'E2E Authoring'
const FIRST_CHATBOT = `${CHATBOT_PREFIX} One`
const SECOND_CHATBOT = `${CHATBOT_PREFIX} Two`

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

  test('creates, edits, previews, switches, and reloads draft chatbots', async ({
    page,
  }) => {
    await createChatbot(page, FIRST_CHATBOT)

    await page
      .getByTestId('chatbot-description')
      .fill('Updated persisted description')
    await page.getByTestId('save-chatbot-metadata').click()
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
    await disclaimerEditor.press('ControlOrMeta+A')
    const boldButton = page.getByTestId('content-input-bold')
    await expect(boldButton).toHaveJSProperty('tagName', 'BUTTON')
    await boldButton.focus()
    await boldButton.press('Enter')
    await expect(disclaimerEditor.locator('strong')).toContainText(
      'Use this chatbot as a learning aid.'
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
    await expect(
      page.getByRole('status').filter({ hasText: 'Chatbot disclaimer saved.' })
    ).toBeVisible()

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
    ).toContainText('Use this chatbot as a learning aid.')

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
    ).toContainText('Use this chatbot as a learning aid.')
  })
})
