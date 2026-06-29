import { expect, test } from '@playwright/test'
import {
  CHATBOT_ID,
  chatUrl,
  clearChatCookies,
  getEnrolledParticipantId,
  mockChatStream,
  resetChatState,
  seedThread,
  setCredits,
  setDisclaimerRequired,
  setDisclaimerState,
  setModelSelection,
  setParticipantToken,
} from '../util/chat.js'

/**
 * Chatbot (apps/chat) E2E
 *
 * - chatbot, disclaimer, participants are seeded
 * - each test sets up real DB state (credits, disclaimer acceptance,
 *   threads) via Prisma and exercises the real chat API routes through the UI
 * - POST /chat is mocked.
 */

async function visitChat(page: import('@playwright/test').Page) {
  await page.goto(`${chatUrl()}/${CHATBOT_ID}`, {
    waitUntil: 'domcontentloaded',
  })
}

// ===========================================================================
// Authentication & Access Control
// ===========================================================================
test.describe('Chatbot Authentication & Access Control', () => {
  test.beforeEach(async ({ page }) => {
    await clearChatCookies(page)
  })

  test('Unauthenticated user is redirected to /noLogin', async ({ page }) => {
    await visitChat(page)
    await expect(page).toHaveURL(/\/noLogin/)
  })

  test('/noLogin page shows login-required message and login link', async ({
    page,
  }) => {
    await page.goto(`${chatUrl()}/noLogin?redirectTo=/${CHATBOT_ID}`, {
      waitUntil: 'domcontentloaded',
    })

    await expect(page.getByTestId('chat-no-login')).toBeVisible()
    await expect(page.getByTestId('chat-no-login-title')).toContainText(
      'Login Required'
    )
    await expect(page.getByTestId('chat-no-login-link')).toContainText(
      'Go to KlickerUZH Login'
    )
  })

  test('Authenticated user with valid participation can access chatbot', async ({
    page,
  }) => {
    const participantId = await getEnrolledParticipantId()
    await setParticipantToken(page, participantId)
    await resetChatState(participantId)
    await setDisclaimerState(participantId, 'accepted')
    await visitChat(page)

    await expect(page).not.toHaveURL(/\/noLogin/)
    await expect(page.getByTestId('chat-no-login')).toHaveCount(0)
    await expect(page.getByTestId('chat-composer')).toBeVisible()
  })
})

// ===========================================================================
// Disclaimer Flow
// ===========================================================================
test.describe('Chatbot Disclaimer Flow', () => {
  let participantId: string

  test.beforeEach(async ({ page }) => {
    participantId = await getEnrolledParticipantId()
    await clearChatCookies(page)
    await setParticipantToken(page, participantId)
    await resetChatState(participantId)
  })

  test('Disclaimer modal appears when required and not yet accepted', async ({
    page,
  }) => {
    await visitChat(page)

    await expect(page.getByTestId('chat-disclaimer-content')).toBeVisible()
    await expect(page.getByTestId('chat-disclaimer-accept')).toBeVisible()
    await expect(page.getByTestId('chat-disclaimer-decline')).toBeVisible()
  })

  test('Disclaimer modal displays Student Responsibility and Data Protection sections', async ({
    page,
  }) => {
    await visitChat(page)

    const content = page.getByTestId('chat-disclaimer-content')
    await expect(content).toBeVisible()
    await expect(content).toContainText('Student Responsibility')
    await expect(content).toContainText('Data Protection')
    await expect(content).toContainText('What happens after your choice')
  })

  test('Accepting disclaimer closes modal and enables chat', async ({
    page,
  }) => {
    await visitChat(page)

    await page.getByTestId('chat-disclaimer-accept').click()

    await expect(page.getByTestId('chat-disclaimer-content')).toHaveCount(0)
    await expect(page.getByTestId('chat-composer')).toBeVisible()
  })

  test('Declining disclaimer shows blocked message', async ({ page }) => {
    await visitChat(page)

    await page.getByTestId('chat-disclaimer-decline').click()

    await expect(page.getByTestId('chat-disclaimer-declined')).toBeVisible()
    await expect(page.getByTestId('chat-disclaimer-declined')).toContainText(
      'Chatbot unavailable'
    )
    await expect(page.getByTestId('chat-disclaimer-declined')).toContainText(
      'You declined the chatbot disclaimer'
    )
  })

  test('"Show disclaimer again" button re-opens modal after decline', async ({
    page,
  }) => {
    await visitChat(page)

    await page.getByTestId('chat-disclaimer-decline').click()
    await expect(page.getByTestId('chat-disclaimer-declined')).toBeVisible()

    await page.getByTestId('chat-show-disclaimer-again').click()

    await expect(page.getByTestId('chat-disclaimer-content')).toBeVisible()
    await expect(page.getByTestId('chat-disclaimer-accept')).toBeVisible()
  })

  test('No disclaimer modal appears when disclaimer is already accepted', async ({
    page,
  }) => {
    await setDisclaimerState(participantId, 'accepted')
    await visitChat(page)

    await expect(page.getByTestId('chat-disclaimer-content')).toHaveCount(0)
    await expect(page.getByTestId('chat-composer')).toBeVisible()
  })

  test('No disclaimer modal appears when no disclaimer is required', async ({
    page,
  }) => {
    await setDisclaimerRequired(false)
    await visitChat(page)

    await expect(page.getByTestId('chat-disclaimer-content')).toHaveCount(0)
    await expect(page.getByTestId('chat-composer')).toBeVisible()
  })
})

// ===========================================================================
// Thread Management
// ===========================================================================
test.describe('Chatbot Thread Management', () => {
  let participantId: string

  test.beforeEach(async ({ page }) => {
    participantId = await getEnrolledParticipantId()
    await clearChatCookies(page)
    await setParticipantToken(page, participantId)
    await resetChatState(participantId)
    await setDisclaimerState(participantId, 'accepted')
  })

  test('Sidebar shows Chat History header and New Chat button', async ({
    page,
  }) => {
    await visitChat(page)
    await expect(page.getByTestId('chat-new-thread-button')).toBeVisible()
  })

  test('Existing threads appear in the sidebar thread list', async ({
    page,
  }) => {
    await seedThread(participantId, { title: 'First conversation' })
    await seedThread(participantId, { title: 'Second conversation' })
    await visitChat(page)

    await expect(page.getByTestId('chat-thread-list')).toBeVisible()
    await expect(page.getByTestId('chat-thread-item')).toHaveCount(2)
    await expect(page.getByText('First conversation')).toBeVisible()
    await expect(page.getByText('Second conversation')).toBeVisible()
  })

  test('Clicking "New Chat" creates a new thread and navigates to it', async ({
    page,
  }) => {
    await visitChat(page)

    await page.getByTestId('chat-new-thread-button').click()

    await expect(page).toHaveURL(/\/threads\/[0-9a-f-]{36}/)
  })

  test('Clicking a thread in sidebar navigates to it and loads messages', async ({
    page,
  }) => {
    await seedThread(participantId, {
      title: 'Greeting thread',
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'Hello chatbot!' }] },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello! How can I help you today?' }],
        },
      ],
    })
    await visitChat(page)

    await page.getByTestId('chat-thread-select').first().click()

    await expect(page).toHaveURL(/\/threads\/[0-9a-f-]{36}/)
    await expect(page.getByTestId('chat-user-message')).toBeVisible()
    await expect(page.getByTestId('chat-assistant-message')).toBeVisible()
  })

  test('Thread edit icon opens inline title editing', async ({ page }) => {
    await seedThread(participantId, { title: 'Editable thread' })
    await visitChat(page)

    const item = page.getByTestId('chat-thread-item').first()
    await item.hover()
    await item.getByTestId('chat-thread-edit-button').click()

    await expect(page.getByTestId('chat-thread-title-input')).toBeVisible()
    await expect(page.getByTestId('chat-thread-title-save')).toBeVisible()
    await expect(page.getByTestId('chat-thread-title-cancel')).toBeVisible()
  })

  test('Saving an edited thread title calls the API', async ({ page }) => {
    await seedThread(participantId, { title: 'Old title' })
    await visitChat(page)

    const item = page.getByTestId('chat-thread-item').first()
    await item.hover()
    await item.getByTestId('chat-thread-edit-button').click()

    await page.getByTestId('chat-thread-title-input').fill('Updated Title')

    const titleUpdate = page.waitForRequest(
      (req) =>
        req.method() === 'PUT' && /\/threads\/[^/]+\/title$/.test(req.url())
    )
    await page.getByTestId('chat-thread-title-save').click()
    await titleUpdate

    await expect(page.getByTestId('chat-thread-title-input')).toHaveCount(0)
    await expect(page.getByText('Updated Title')).toBeVisible()
  })

  test('Cancelling title edit reverts the input', async ({ page }) => {
    await seedThread(participantId, { title: 'Keep me' })
    await visitChat(page)

    const item = page.getByTestId('chat-thread-item').first()
    await item.hover()
    await item.getByTestId('chat-thread-edit-button').click()

    await page.getByTestId('chat-thread-title-cancel').click()

    await expect(page.getByTestId('chat-thread-title-input')).toHaveCount(0)
    await expect(page.getByText('Keep me')).toBeVisible()
  })

  test('Deleting a thread removes it from the sidebar', async ({ page }) => {
    await seedThread(participantId, { title: 'Delete me' })
    await seedThread(participantId, { title: 'Survivor' })
    await visitChat(page)

    await expect(page.getByTestId('chat-thread-item')).toHaveCount(2)

    const item = page.getByTestId('chat-thread-item').filter({
      hasText: 'Delete me',
    })
    await item.hover()
    await item.getByTestId('chat-thread-delete-button').click()

    await expect(page.getByTestId('chat-thread-item')).toHaveCount(1)
    await expect(page.getByText('Delete me')).toHaveCount(0)
  })

  test('Empty thread list shows no thread items', async ({ page }) => {
    await visitChat(page)

    await expect(page.getByTestId('chat-thread-list')).toBeVisible()
    await expect(page.getByTestId('chat-thread-item')).toHaveCount(0)
  })
})

// ===========================================================================
// Messaging Interface
// ===========================================================================
test.describe('Chatbot Messaging Interface', () => {
  let participantId: string

  test.beforeEach(async ({ page }) => {
    participantId = await getEnrolledParticipantId()
    await clearChatCookies(page)
    await setParticipantToken(page, participantId)
    await resetChatState(participantId)
    await setDisclaimerState(participantId, 'accepted')
    await mockChatStream(page, 'This is a test response from the AI assistant.')
  })

  async function typeMessage(
    page: import('@playwright/test').Page,
    text: string
  ) {
    const input = page.getByTestId('chat-composer-input')
    await input.click()
    await input.pressSequentially(text)
  }

  test('Empty chat shows welcome message', async ({ page }) => {
    await visitChat(page)

    await expect(page.getByTestId('chat-welcome-message')).toBeVisible()
    await expect(page.getByTestId('chat-welcome-message')).toContainText(
      'How can I help you'
    )
  })

  test('Composer input is visible and accepts text', async ({ page }) => {
    await visitChat(page)

    await expect(page.getByTestId('chat-composer')).toBeVisible()
    const input = page.getByTestId('chat-composer-input')
    await expect(input).toBeVisible()
    await expect(input).toHaveAttribute('placeholder', 'Write a message...')

    await typeMessage(page, 'Hello, chatbot!')
    await expect(input).toHaveValue('Hello, chatbot!')
  })

  test('Send button is present and clickable', async ({ page }) => {
    await visitChat(page)

    await typeMessage(page, 'Test message')
    await expect(page.getByTestId('chat-send-button')).toBeVisible()
  })

  test('Sending a message displays user message in the thread', async ({
    page,
  }) => {
    await visitChat(page)

    await typeMessage(page, 'Hello, chatbot!')
    await page.getByTestId('chat-send-button').click()

    await expect(page.getByTestId('chat-user-message')).toBeVisible()
    await expect(page.getByTestId('chat-user-message-content')).toContainText(
      'Hello, chatbot!'
    )
  })

  test('Assistant response appears after sending a message', async ({
    page,
  }) => {
    await visitChat(page)

    await typeMessage(page, 'Hello, chatbot!')
    await page.getByTestId('chat-send-button').click()

    await expect(page.getByTestId('chat-assistant-message')).toBeVisible({
      timeout: 15_000,
    })
    await expect(
      page.getByTestId('chat-assistant-message-content')
    ).toBeVisible()
  })

  test('Welcome message disappears after sending first message', async ({
    page,
  }) => {
    await visitChat(page)

    await expect(page.getByTestId('chat-welcome-message')).toBeVisible()

    await typeMessage(page, 'Hello!')
    await page.getByTestId('chat-send-button').click()

    await expect(page.getByTestId('chat-welcome-message')).toHaveCount(0)
  })

  test('Existing thread with messages renders user and assistant messages', async ({
    page,
  }) => {
    await seedThread(participantId, {
      title: 'Photosynthesis',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'What is photosynthesis?' }],
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Photosynthesis is the process by which plants convert sunlight into energy.',
            },
          ],
        },
      ],
    })
    await visitChat(page)

    await page.getByTestId('chat-thread-select').first().click()

    await expect(page.getByTestId('chat-user-message-content')).toContainText(
      'What is photosynthesis?'
    )
    await expect(
      page.getByTestId('chat-assistant-message-content')
    ).toContainText('Photosynthesis is the process')
  })
})

// ===========================================================================
// Settings Panel
// ===========================================================================
test.describe('Chatbot Settings Panel', () => {
  let participantId: string

  test.beforeEach(async ({ page }) => {
    participantId = await getEnrolledParticipantId()
    await clearChatCookies(page)
    await setParticipantToken(page, participantId)
    await resetChatState(participantId)
    await setDisclaimerState(participantId, 'accepted')
  })

  async function openSettings(page: import('@playwright/test').Page) {
    await expect(page.getByTestId('chat-settings-toggle')).toBeVisible()
    await page.getByTestId('chat-settings-toggle').click()
    await expect(page.getByTestId('chat-settings-panel')).toBeVisible()
  }

  test('Settings toggle is visible and opens the panel', async ({ page }) => {
    await visitChat(page)

    await expect(page.getByTestId('chat-settings-toggle')).toBeVisible()
    await expect(page.getByTestId('chat-settings-toggle')).toContainText(
      'Settings'
    )
    await expect(page.getByTestId('chat-settings-panel')).toHaveCount(0)
    await openSettings(page)
  })

  test('Clicking settings toggle collapses and expands the panel', async ({
    page,
  }) => {
    await visitChat(page)

    await page.getByTestId('chat-settings-toggle').click()
    await expect(page.getByTestId('chat-settings-panel')).toBeVisible()

    await page.getByTestId('chat-settings-toggle').click()
    await expect(page.getByTestId('chat-settings-panel')).toHaveCount(0)
  })

  test('Chat mode section shows available modes', async ({ page }) => {
    await visitChat(page)
    await openSettings(page)

    const modeSection = page.getByTestId('chat-mode-selection')
    await expect(modeSection).toBeVisible()
    await expect(modeSection).toContainText('Chat Mode')
  })

  test('AI model section displays current model (automatic mode)', async ({
    page,
  }) => {
    await setModelSelection(participantId, false)
    await visitChat(page)
    await openSettings(page)

    const modelSection = page.getByTestId('chat-model-selection')
    await expect(modelSection).toBeVisible()
    await expect(modelSection).toContainText('AI Model')
    await expect(page.getByTestId('chat-model-display')).toBeVisible()
  })

  test('Credits display shows current/total and percentage', async ({
    page,
  }) => {
    await setCredits(participantId, 75, 100)
    await visitChat(page)

    await expect(page.getByTestId('chat-credits-section')).toBeVisible()
    await expect(page.getByTestId('chat-credits-display')).toContainText(
      '75 / 100'
    )
  })

  test('Zero credits shows "used up all credits" message', async ({ page }) => {
    await setCredits(participantId, 0, 100)
    await visitChat(page)

    await expect(page.getByTestId('chat-credits-section')).toBeVisible()
    await expect(page.getByTestId('chat-credits-display')).toContainText(
      '0 / 100'
    )
    await expect(page.getByTestId('chat-credits-empty-message')).toContainText(
      'You have used up all your credits'
    )
  })

  test('Credits display shows zero percentage when total is zero', async ({
    page,
  }) => {
    await setCredits(participantId, 0, 0)
    await visitChat(page)

    await expect(page.getByTestId('chat-credits-display')).toContainText(
      '0 / 0'
    )
  })

  test('Model selection dropdown appears when modelSelection is enabled', async ({
    page,
  }) => {
    await setModelSelection(participantId, true)
    await visitChat(page)
    await openSettings(page)

    await expect(page.getByTestId('chat-model-selection')).toBeVisible()
    await expect(page.getByTestId('chat-model-display')).toHaveCount(0)
  })

  test('Reasoning effort selector is wired up when model selection is enabled', async ({
    page,
  }) => {
    await setModelSelection(participantId, true)
    await visitChat(page)
    await openSettings(page)

    await expect(page.getByTestId('chat-settings-panel')).toBeVisible()
    await expect(page.getByTestId('chat-model-selection')).toBeVisible()
  })
})
