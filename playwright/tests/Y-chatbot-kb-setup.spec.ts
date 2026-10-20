import { expect, type Page } from '@playwright/test'
import { getPrisma } from '../global-setup.js'
import { test } from '../util/fixtures.js'
import { selectOption } from '../util/fixtures/activities.js'
import { mockGrowthBookFeatureFlags } from '../util/fixtures/manage.js'
import { URL_MANAGE, USER_ID_TEST } from '../util/constants.js'

const PREFIX = 'E2E KB Setup'
const CHATBOT_NAME = `${PREFIX} Chatbot`
const KB_NAME = `${PREFIX} Material`

async function cleanup() {
  const prisma = await getPrisma()
  await prisma.chatbot.deleteMany({
    where: { ownerId: USER_ID_TEST, name: { startsWith: PREFIX } },
  })
  await prisma.kB.deleteMany({
    where: { ownerId: USER_ID_TEST, name: { startsWith: PREFIX } },
  })
  await prisma.chatbotDisclaimer.deleteMany({
    where: { name: { startsWith: PREFIX } },
  })
}

async function createDraftChatbot(page: Page) {
  await page.getByTestId('create-chatbot').click()
  await page.getByTestId('create-chatbot-name').fill(CHATBOT_NAME)
  await page
    .getByTestId('create-chatbot-description')
    .fill(`${CHATBOT_NAME} description`)
  await selectOption(page, '[data-cy="create-chatbot-course"]', 'Testkurs')
  await page.getByTestId('submit-create-chatbot').click()
  await expect(page.getByTestId(`chatbot-${CHATBOT_NAME}`)).toBeVisible()

  const chatbotId = new URL(page.url()).searchParams.get('chatbotId')
  expect(chatbotId).toBeTruthy()
  return chatbotId as string
}

test.describe('Chatbot knowledge base setup', () => {
  test.beforeEach(async ({ loginLecturer, page }) => {
    await cleanup()
    await mockGrowthBookFeatureFlags(page, { aiBeta: true })
    await loginLecturer()
    await page.goto(
      `${process.env.URL_MANAGE ?? URL_MANAGE}/resources/chatbots`
    )
    await expect(page.getByTestId('create-chatbot')).toBeVisible()
  })

  test.afterEach(async () => {
    await cleanup()
  })

  test('creates, connects, disconnects and reconnects material from the chatbot', async ({
    page,
  }) => {
    const chatbotId = await createDraftChatbot(page)
    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE

    await page.goto(
      `${manageUrl}/resources/chatbots?chatbotId=${chatbotId}&view=knowledge`
    )
    await expect(page.getByTestId('chatbot-kb-setup')).toBeVisible()
    await expect(
      page.getByTestId('chatbot-no-enabled-knowledge-base')
    ).toBeVisible()
    // A draft change is reviewed with the next publication request.
    await expect(page.getByTestId('chatbot-kb-live-change-note')).toHaveCount(0)

    // Creating from the chatbot connects the new knowledge base and opens it
    // with a way back to the chatbot.
    await page.getByTestId('chatbot-kb-create').click()
    await page.getByTestId('knowledge-base-name').fill(KB_NAME)
    await page.getByTestId('submit-create-knowledge-base').click()

    await expect(page).toHaveURL(
      new RegExp(`/resources/knowledgeBases/[^?]+\\?chatbotId=${chatbotId}$`)
    )
    const backLink = page.getByTestId('kb-back-to-chatbot')
    await expect(backLink).toBeVisible()
    await expect(backLink).toContainText(CHATBOT_NAME)

    await backLink.click()
    await expect(page).toHaveURL(
      new RegExp(`/resources/chatbots\\?chatbotId=${chatbotId}&view=knowledge$`)
    )
    await expect(page.getByTestId('chatbot-enabled-knowledge-base')).toHaveText(
      KB_NAME
    )

    await page.getByTestId('chatbot-kb-disconnect').click()
    await expect(
      page.getByTestId('chatbot-no-enabled-knowledge-base')
    ).toBeVisible()
    await expect(page.getByTestId('chatbot-kb-disconnect')).toHaveCount(0)

    // An existing knowledge base is connected by selecting it.
    await selectOption(page, '[data-cy="chatbot-kb-select"]', KB_NAME)
    await page.getByTestId('chatbot-kb-connect').click()
    await expect(page.getByTestId('chatbot-enabled-knowledge-base')).toHaveText(
      KB_NAME
    )

    await page.reload()
    await expect(page.getByTestId('chatbot-enabled-knowledge-base')).toHaveText(
      KB_NAME
    )
  })

  test('creates a chatbot that uses the knowledge base from the knowledge base page', async ({
    page,
  }) => {
    const prisma = await getPrisma()
    const kb = await prisma.kB.create({
      data: { name: KB_NAME, ownerId: USER_ID_TEST },
    })
    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE

    await page.goto(`${manageUrl}/resources/knowledgeBases/${kb.id}`)
    await page.getByTestId('kb-chatbot-settings').locator('summary').click()
    await page.getByTestId('kb-create-chatbot').click()

    const chatbotNameField = page.getByTestId('create-chatbot-name')
    await expect(chatbotNameField).toBeVisible()
    await chatbotNameField.fill(CHATBOT_NAME)
    await selectOption(page, '[data-cy="create-chatbot-course"]', 'Testkurs')
    await page.getByTestId('submit-create-chatbot').click()

    // The new chatbot opens on its Knowledge view with the knowledge base
    // already connected, and the creation request is not repeated on reload.
    await expect(page.getByTestId('chatbot-enabled-knowledge-base')).toHaveText(
      KB_NAME
    )
    const url = new URL(page.url())
    expect(url.searchParams.get('view')).toBe('knowledge')
    expect(url.searchParams.get('createForKb')).toBeNull()

    await page.reload()
    await expect(page.getByTestId('chatbot-enabled-knowledge-base')).toHaveText(
      KB_NAME
    )
    await expect(chatbotNameField).toHaveCount(0)
  })

  test('offers no way back for a chatbot the lecturer does not own', async ({
    page,
  }) => {
    const prisma = await getPrisma()
    const kb = await prisma.kB.create({
      data: { name: KB_NAME, ownerId: USER_ID_TEST },
    })
    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE

    await page.goto(
      `${manageUrl}/resources/knowledgeBases/${kb.id}?chatbotId=00000000-0000-4000-8000-000000000000`
    )
    await expect(page.getByTestId('knowledge-base-detail')).toBeVisible()
    await expect(page.getByTestId('kb-back-to-chatbot')).toHaveCount(0)
  })
})
