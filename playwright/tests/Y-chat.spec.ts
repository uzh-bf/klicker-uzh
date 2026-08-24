import { expect, test, type Page } from '@playwright/test'
import { getPrisma } from '../global-setup.js'
import {
  CHATBOT_ID,
  chatUrl,
  clearChatCookies,
  getEnrolledParticipantId,
  getMessageRating,
  mockChatStream,
  OTHER_PARTICIPANT_ID,
  resetChatState,
  seedThread,
  setCredits,
  setDisclaimerRequired,
  setDisclaimerState,
  setModelSelection,
  setParticipantToken,
  TEST_PNG_DATA_URL,
  testImageUpload,
} from '../util/chat.js'
import { selectOption } from '../util/workflow.js'

const UNKNOWN_CHATBOT_ID = '00000000-0000-4000-8000-000000000404'
const MALFORMED_CHATBOT_ID = 'not-a-chatbot-id'

/**
 * Chatbot (apps/chat) E2E
 *
 * - chatbot, disclaimer, participants are seeded
 * - each test sets up real DB state (credits, disclaimer acceptance,
 *   threads) via Prisma and exercises the real chat API routes through the UI
 * - POST /chat is mocked.
 */

async function visitChat(page: Page) {
  await page.goto(`${chatUrl()}/${CHATBOT_ID}`, {
    waitUntil: 'domcontentloaded',
  })
}

async function typeMessage(page: Page, text: string) {
  const input = page.getByTestId('chat-composer-input')
  await input.click()
  await input.pressSequentially(text)
}

/** Type message and send via send button */
async function sendMessage(page: Page, text: string) {
  await typeMessage(page, text)
  await page.getByTestId('chat-send-button').click()
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
    await expect(page.getByTestId('chat-no-login')).not.toContainText(
      CHATBOT_ID
    )
    await expect(page.getByTestId('chat-no-login')).toContainText(
      'After logging in, you will return to this chatbot.'
    )
  })

  test('Unknown chatbot link shows branded not-found recovery', async ({
    page,
  }) => {
    await setParticipantToken(page, await getEnrolledParticipantId())

    const response = await page.goto(`${chatUrl()}/${UNKNOWN_CHATBOT_ID}`, {
      waitUntil: 'domcontentloaded',
    })

    expect(response?.status()).toBe(404)
    await expect(page.locator('[data-cy="chat-not-found"]')).toBeVisible()
    await expect(page.locator('[data-cy="chat-not-found-title"]')).toHaveText(
      'Chatbot not found'
    )
    await expect(page.locator('[data-cy="chat-not-found-home"]')).toContainText(
      'Open KlickerUZH'
    )
  })

  test('Malformed chatbot link shows branded not-found recovery', async ({
    page,
  }) => {
    await setParticipantToken(page, await getEnrolledParticipantId())

    const response = await page.goto(`${chatUrl()}/${MALFORMED_CHATBOT_ID}`, {
      waitUntil: 'domcontentloaded',
    })

    expect(response?.status()).toBe(404)
    await expect(page.locator('[data-cy="chat-not-found"]')).toBeVisible()
    await expect(page.locator('[data-cy="chat-not-found-title"]')).toHaveText(
      'Chatbot not found'
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

  test('Disclaimer explains consequences before the explicit actions', async ({
    page,
  }) => {
    await visitChat(page)

    const consequences = page.getByTestId('chat-disclaimer-consequences')
    const actions = page.getByTestId('chat-disclaimer-actions')
    const dialog = page.getByRole('dialog')

    await expect(consequences).toBeVisible()
    await expect(actions).toBeVisible()
    await expect(dialog.getByRole('button', { name: /^close$/i })).toHaveCount(
      0
    )
    await expect(
      consequences.locator(
        'xpath=following-sibling::*[@data-cy="chat-disclaimer-actions"]'
      )
    ).toHaveCount(1)

    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
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
    const deleteButton = item.getByTestId('chat-thread-delete-button')

    // First click only arms an inline confirm — it must not delete yet.
    await deleteButton.click()
    await expect(deleteButton).toHaveText('Delete?')
    await expect(deleteButton).toHaveAccessibleName(
      'Confirm deleting this chat'
    )
    await expect(page.getByTestId('chat-thread-item')).toHaveCount(2)

    // Second click while still armed performs the actual delete.
    await deleteButton.click()

    await expect(page.getByTestId('chat-thread-item')).toHaveCount(1)
    await expect(page.getByText('Delete me')).toHaveCount(0)
  })

  test('Delete confirm reverts when the pointer leaves the row', async ({
    page,
  }) => {
    await seedThread(participantId, { title: 'Keep me armed-free' })
    await visitChat(page)

    const item = page.getByTestId('chat-thread-item').filter({
      hasText: 'Keep me armed-free',
    })
    await item.hover()
    const deleteButton = item.getByTestId('chat-thread-delete-button')

    await deleteButton.click()
    await expect(deleteButton).toHaveText('Delete?')

    // Move the pointer well away from the sidebar row rather than clicking
    // again — the confirm button is hidden again once not hovered, so
    // re-hover the row afterwards to read its state back out.
    await page.getByTestId('chat-composer-input').hover()
    await item.hover()

    await expect(deleteButton).toHaveAccessibleName('Delete chat')
    await expect(page.getByTestId('chat-thread-item')).toHaveCount(1)
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
    await mockChatStream(page)
  })

  test('Empty chat shows welcome message', async ({ page }) => {
    await visitChat(page)

    await expect(page.getByTestId('chat-welcome-message')).toBeVisible()
    await expect(page.getByTestId('chat-welcome-chatbot')).toHaveText(
      'You are chatting with E2E Chatbot.'
    )
    await expect(page.getByTestId('chat-welcome-mode')).toContainText(
      'Tutor mode.'
    )
    await expect(page.getByTestId('chat-welcome-suggestion')).toHaveCount(2)
  })

  test('Starter prompt is editable and contains no raw placeholder', async ({
    page,
  }) => {
    await visitChat(page)

    await page.getByTestId('chat-welcome-suggestion').first().click()

    const input = page.getByTestId('chat-composer-input')
    await expect(input).toHaveValue(/.+/)
    const starter = await input.inputValue()
    expect(starter.length).toBeGreaterThan(0)
    expect(starter).not.toMatch(/\[[^\]]+\]/)
    await expect(page.getByTestId('chat-user-message')).toHaveCount(0)
    await input.fill('My own question about a specific topic')
    await expect(input).toHaveValue('My own question about a specific topic')
    await expect(page.getByTestId('chat-send-button')).toBeEnabled()

    await page.getByTestId('chat-send-button').click()
    await expect(page.getByTestId('chat-user-message-content')).toContainText(
      'My own question about a specific topic'
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

  test('Streaming keeps the assistant message mounted as text arrives', async ({
    page,
  }) => {
    await mockChatStream(page, {
      textChunks: ['The first part', ' and the second part', ' and the end.'],
      chunkDelayMs: 80,
      pauseAfterTextChunk: 1,
    })
    await visitChat(page)

    await sendMessage(page, 'Stream a stable answer')

    const assistant = page.getByTestId('chat-assistant-message')
    const assistantContent = page.getByTestId('chat-assistant-message-content')
    await expect(assistantContent).toContainText('The first part', {
      timeout: 15_000,
    })
    await expect(assistantContent).not.toContainText('and the end.')
    await assistant.evaluate((node) => {
      const state = window as typeof window & {
        __assistantMessageBeforeStreamUpdate?: Element
      }
      state.__assistantMessageBeforeStreamUpdate = node
    })

    await page.evaluate(() => {
      const state = window as typeof window & {
        __releaseMockChatStream?: () => void
      }
      state.__releaseMockChatStream?.()
    })

    await expect(assistantContent).toContainText('and the end.', {
      timeout: 15_000,
    })

    const stayedMounted = await page.evaluate(() => {
      const state = window as typeof window & {
        __assistantMessageBeforeStreamUpdate?: Element
      }
      const current = document.querySelector(
        '[data-cy="chat-assistant-message"]'
      )
      return state.__assistantMessageBeforeStreamUpdate === current
    })

    expect(stayedMounted).toBe(true)
  })

  test('Streaming hides incomplete LaTeX until the formula closes', async ({
    page,
  }) => {
    await mockChatStream(page, {
      textChunks: [
        'The answer is ',
        '\\[x^2 + 1',
        '\\]',
        '\n\nThe answer is complete. See [Reference](https://example.com/reference).',
      ],
      chunkDelayMs: 80,
      pauseAfterTextChunk: 2,
    })
    await visitChat(page)

    await sendMessage(page, 'Stream a formula without flicker')

    const assistant = page.getByTestId('chat-assistant-message')
    const assistantContent = page.getByTestId('chat-assistant-message-content')
    await expect(assistantContent).toContainText('The answer is', {
      timeout: 15_000,
    })
    await expect(assistantContent).not.toContainText('x^2')
    await expect(assistantContent.locator('.katex')).toHaveCount(0)

    await assistant.evaluate((node) => {
      const state = window as typeof window & {
        __assistantMessageBeforeMathRelease?: Element
        __mathStreamSnapshots?: Array<{
          hasRawDelimiter: boolean
          hasUnrenderedFormula: boolean
          hasKatexError: boolean
        }>
        __mathStreamObserver?: MutationObserver
      }
      state.__assistantMessageBeforeMathRelease = node
      state.__mathStreamSnapshots = []
      state.__mathStreamObserver = new MutationObserver(() => {
        const text = node.textContent ?? ''
        state.__mathStreamSnapshots?.push({
          hasRawDelimiter: text.includes('\\[') || text.includes('\\]'),
          hasUnrenderedFormula:
            text.includes('x^2 + 1') && !node.querySelector('.katex'),
          hasKatexError: Boolean(node.querySelector('.katex-error')),
        })
      })
      state.__mathStreamObserver.observe(node, {
        childList: true,
        characterData: true,
        subtree: true,
      })
    })

    await page.evaluate(() => {
      const state = window as typeof window & {
        __releaseMockChatStream?: () => void
      }
      state.__releaseMockChatStream?.()
    })

    await expect(assistantContent.locator('.katex-display')).toHaveCount(1, {
      timeout: 15_000,
    })
    await expect(assistantContent).toContainText('The answer is complete.')
    await expect(
      assistantContent.getByRole('link', { name: 'Reference' })
    ).toBeVisible()

    const streamSnapshots = await page.evaluate(() => {
      const state = window as typeof window & {
        __assistantMessageBeforeMathRelease?: Element
        __mathStreamSnapshots?: Array<{
          hasRawDelimiter: boolean
          hasUnrenderedFormula: boolean
          hasKatexError: boolean
        }>
        __mathStreamObserver?: MutationObserver
      }
      state.__mathStreamObserver?.disconnect()
      return {
        stayedMounted:
          state.__assistantMessageBeforeMathRelease ===
          document.querySelector('[data-cy="chat-assistant-message"]'),
        snapshots: state.__mathStreamSnapshots ?? [],
      }
    })

    expect(streamSnapshots.stayedMounted).toBe(true)
    expect(
      streamSnapshots.snapshots.filter(
        ({ hasRawDelimiter, hasUnrenderedFormula, hasKatexError }) =>
          hasRawDelimiter || hasUnrenderedFormula || hasKatexError
      )
    ).toEqual([])
  })

  test('Streaming hides a dollar delimiter split across chunks', async ({
    page,
  }) => {
    await mockChatStream(page, {
      textChunks: [
        'The answer is ',
        '$',
        'x^2 + 1',
        '$',
        '\n\nThe formula is complete.',
      ],
      chunkDelayMs: 80,
      pauseAfterTextChunk: 2,
    })
    await visitChat(page)

    await sendMessage(page, 'Stream a dollar-delimited formula')

    const assistantContent = page.getByTestId('chat-assistant-message-content')
    await expect(assistantContent).toContainText('The answer is', {
      timeout: 15_000,
    })
    await expect(assistantContent).not.toContainText('$')
    await expect(assistantContent).not.toContainText('x^2')

    await page.evaluate(() => {
      const state = window as typeof window & {
        __releaseMockChatStream?: () => void
      }
      state.__releaseMockChatStream?.()
    })

    await expect(assistantContent.locator('.katex')).toHaveCount(1, {
      timeout: 15_000,
    })
    await expect(assistantContent).toContainText('The formula is complete.')
  })

  test('Streaming hides a backslash delimiter split across chunks', async ({
    page,
  }) => {
    await mockChatStream(page, {
      textChunks: [
        'The answer is ',
        '\\',
        '[x^2 + 1',
        '\\]',
        '\n\nThe formula is complete.',
      ],
      chunkDelayMs: 80,
      pauseAfterTextChunk: 2,
    })
    await visitChat(page)

    await sendMessage(page, 'Stream a backslash-delimited formula')

    const assistantContent = page.getByTestId('chat-assistant-message-content')
    await expect(assistantContent).toContainText('The answer is', {
      timeout: 15_000,
    })
    await expect(assistantContent).not.toContainText('\\')
    await expect(assistantContent).not.toContainText('x^2')

    await page.evaluate(() => {
      const state = window as typeof window & {
        __releaseMockChatStream?: () => void
      }
      state.__releaseMockChatStream?.()
    })

    await expect(assistantContent.locator('.katex')).toHaveCount(1, {
      timeout: 15_000,
    })
    await expect(assistantContent).toContainText('The formula is complete.')
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

  test('Separate LaTeX display blocks do not absorb the prose between them', async ({
    page,
  }) => {
    await seedThread(participantId, {
      title: 'Display math boundaries',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Explain perpendicular slopes.' }],
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: [
                'First formula:',
                '',
                '\\[',
                'm_g \\cdot m_n',
                '=',
                '\\frac{\\Delta y}{\\Delta x}',
                '\\cdot',
                '\\left(-\\frac{\\Delta x}{\\Delta y}\\right)',
                '=-1',
                '\\]',
                '',
                'The prose between the formulas must remain ordinary text.',
                '',
                '[/math]',
                '\\boxed{m_g \\cdot m_n = -1}',
                '[/math]',
                '',
                'The source remains readable: [Course script](https://example.com/course-script.pdf)',
              ].join('\n'),
            },
          ],
        },
      ],
    })
    await visitChat(page)
    await page.getByTestId('chat-thread-select').first().click()

    const content = page.getByTestId('chat-assistant-message-content')
    await expect(content.locator('.katex-display')).toHaveCount(2)
    await expect(content).toContainText(
      'The prose between the formulas must remain ordinary text.'
    )
    await expect(
      content.getByRole('link', { name: 'Course script' })
    ).toBeVisible()
  })

  test('Reasoning and adjacent tool calls use predictable disclosures', async ({
    page,
  }) => {
    await seedThread(participantId, {
      title: 'Tool parts',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Use the available tools' }],
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'reasoning',
              text: 'I should inspect both sources first.',
            },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'library_search',
              args: { query: 'alpha' },
              result: { content: [{ type: 'text', text: 'Alpha result' }] },
            },
            {
              type: 'tool-call',
              toolCallId: 'call-2',
              toolName: 'library_search',
              args: { query: 'beta' },
              result: { content: [{ type: 'text', text: 'Beta result' }] },
            },
            { type: 'text', text: 'I found both sources.' },
            {
              type: 'tool-call',
              toolCallId: 'call-3',
              toolName: 'library_lookup',
              args: { id: 'gamma' },
              result: {
                isError: true,
                content: [{ type: 'text', text: 'Tool execution failed' }],
              },
            },
          ],
        },
      ],
    })
    await visitChat(page)
    await page.getByTestId('chat-thread-select').first().click()

    const reasoningToggle = page.getByTestId('chat-reasoning-toggle')
    await expect(reasoningToggle).toHaveAttribute('aria-expanded', 'false')
    await reasoningToggle.click()
    await expect(reasoningToggle).toHaveAttribute('aria-expanded', 'true')
    await expect(
      page.getByTestId('chat-assistant-message-content')
    ).toContainText('inspect both sources')

    const toolGroupToggle = page.getByTestId('chat-tool-group-toggle')
    await expect(toolGroupToggle).toHaveCount(1)
    await expect(toolGroupToggle).toHaveAttribute('aria-expanded', 'false')
    const singleToolToggle = page.getByTestId('chat-tool-call-toggle')
    await expect(singleToolToggle).toHaveCount(1)
    await expect(singleToolToggle).toContainText(/failed/i)
    await singleToolToggle.click()
    await expect(
      page.getByTestId('chat-assistant-message-content')
    ).toContainText('Tool execution failed')
    await toolGroupToggle.click()
    await expect(toolGroupToggle).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByTestId('chat-tool-call-toggle')).toHaveCount(3)
  })

  test('Sending a message via the Enter key works', async ({ page }) => {
    await visitChat(page)

    const input = page.getByTestId('chat-composer-input')
    await input.click()
    await input.pressSequentially('Sent with Enter')
    await input.press('Enter')

    await expect(page.getByTestId('chat-user-message-content')).toContainText(
      'Sent with Enter'
    )
    await expect(page.getByTestId('chat-assistant-message')).toBeVisible({
      timeout: 15_000,
    })
  })

  test('Multi-turn conversation keeps prior messages', async ({ page }) => {
    await visitChat(page)

    await sendMessage(page, 'First question')
    await expect(page.getByTestId('chat-assistant-message')).toBeVisible({
      timeout: 15_000,
    })

    await sendMessage(page, 'Second question')

    // both user turns remain in the thread, plus an assistant reply each
    await expect(page.getByTestId('chat-user-message')).toHaveCount(2)
    await expect(
      page
        .getByTestId('chat-user-message-content')
        .filter({ hasText: 'First question' })
    ).toHaveCount(1)
    await expect(
      page
        .getByTestId('chat-user-message-content')
        .filter({ hasText: 'Second question' })
    ).toHaveCount(1)
    await expect(page.getByTestId('chat-assistant-message')).toHaveCount(2)
  })
})

// ===========================================================================
// Message Actions & Branching
// ===========================================================================
test.describe('Chatbot Message Actions & Branching', () => {
  let participantId: string

  test.beforeEach(async ({ page }) => {
    participantId = await getEnrolledParticipantId()
    await clearChatCookies(page)
    await setParticipantToken(page, participantId)
    await resetChatState(participantId)
    await setDisclaimerState(participantId, 'accepted')
    await mockChatStream(page)
  })

  test('Copy button copies the assistant message to the clipboard', async ({
    page,
  }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await seedThread(participantId, {
      title: 'Copy test',
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'A question' }] },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'A copyable answer' }],
        },
      ],
    })
    await visitChat(page)
    await page.getByTestId('chat-thread-select').first().click()

    const assistant = page.getByTestId('chat-assistant-message')
    await expect(assistant).toBeVisible()
    await assistant.hover()
    await page.getByTestId('chat-copy-message-button').click()

    const clipboard = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboard).toContain('A copyable answer')
  })

  test('Rating an answer persists, switches and clears', async ({ page }) => {
    const assistantMessageId = '3f0c1a7e-4d2b-4a91-8f6c-2b7d1e5a9c40'
    await seedThread(participantId, {
      title: 'Rating test',
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'A question' }] },
        {
          id: assistantMessageId,
          role: 'assistant',
          content: [{ type: 'text', text: 'A rateable answer' }],
        },
      ],
    })
    await visitChat(page)
    await page.getByTestId('chat-thread-select').first().click()

    const assistant = page.getByTestId('chat-assistant-message')
    await expect(assistant).toBeVisible()
    await assistant.hover()

    const up = page.getByTestId('chat-rate-up-button')
    const down = page.getByTestId('chat-rate-down-button')

    await assistant.evaluate((node) => {
      const state = window as typeof window & {
        __assistantMessageBeforeFeedback?: Element
      }
      state.__assistantMessageBeforeFeedback = node
    })

    await up.click()
    await expect(up).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => getMessageRating(assistantMessageId)).toBe('UP')
    await expect
      .poll(() =>
        page.evaluate(() => {
          const state = window as typeof window & {
            __assistantMessageBeforeFeedback?: Element
          }
          return (
            state.__assistantMessageBeforeFeedback ===
            document.querySelector('[data-cy="chat-assistant-message"]')
          )
        })
      )
      .toBe(true)

    // Changing one's mind replaces the vote rather than stacking a second one.
    await down.click()
    await expect(down).toHaveAttribute('aria-pressed', 'true')
    await expect(up).toHaveAttribute('aria-pressed', 'false')
    await expect.poll(() => getMessageRating(assistantMessageId)).toBe('DOWN')

    // Clicking the active vote retracts it.
    await down.click()
    await expect(down).toHaveAttribute('aria-pressed', 'false')
    await expect.poll(() => getMessageRating(assistantMessageId)).toBeNull()
  })

  // A vote only counts if it survives leaving the page: the reloaded thread
  // carries its persisted rating into chatStore, and MessageRatingButtons reads
  // that store value directly rather than relying on assistant-ui metadata.
  test('A stored rating is restored after a page reload', async ({ page }) => {
    const assistantMessageId = '3f0c1a7e-4d2b-4a91-8f6c-2b7d1e5a9c41'
    await seedThread(participantId, {
      title: 'Rating persistence test',
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'A question' }] },
        {
          id: assistantMessageId,
          role: 'assistant',
          content: [{ type: 'text', text: 'A rateable answer' }],
        },
      ],
    })
    await visitChat(page)
    await page.getByTestId('chat-thread-select').first().click()
    await expect(page).toHaveURL(/\/threads\//)

    const assistant = page.getByTestId('chat-assistant-message')
    await expect(assistant).toBeVisible()
    await assistant.hover()

    await page.getByTestId('chat-rate-up-button').click()
    await expect(page.getByTestId('chat-rate-up-button')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect.poll(() => getMessageRating(assistantMessageId)).toBe('UP')

    await page.reload({ waitUntil: 'domcontentloaded' })

    const reloadedAssistant = page.getByTestId('chat-assistant-message')
    await expect(reloadedAssistant).toBeVisible()
    await reloadedAssistant.hover()

    await expect(page.getByTestId('chat-rate-up-button')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect(page.getByTestId('chat-rate-down-button')).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  // The feedback route scopes its lookup by participant AND chatbot, and
  // reports someone else's message as missing rather than forbidden, so the
  // message id cannot be used to probe which ids exist. The own-message call
  // first proves the request shape is right — otherwise any typo in the URL
  // would produce the expected 404 for the wrong reason.
  test('Rating another participant’s message returns 404', async ({ page }) => {
    const ownMessageId = '3f0c1a7e-4d2b-4a91-8f6c-2b7d1e5a9c42'
    const ownThread = await seedThread(participantId, {
      title: 'Own rateable thread',
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'My question' }] },
        {
          id: ownMessageId,
          role: 'assistant',
          content: [{ type: 'text', text: 'My answer' }],
        },
      ],
    })

    const foreignMessageId = '3f0c1a7e-4d2b-4a91-8f6c-2b7d1e5a9c43'
    await resetChatState(OTHER_PARTICIPANT_ID)
    const foreignThread = await seedThread(OTHER_PARTICIPANT_ID, {
      title: 'Someone else’s thread',
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'Their question' }] },
        {
          id: foreignMessageId,
          role: 'assistant',
          content: [{ type: 'text', text: 'Their answer' }],
        },
      ],
    })

    // `page.request` shares this context's cookie jar, so both calls carry the
    // participant token minted in `beforeEach` for `participantId`.
    const feedbackUrl = (threadId: string, messageId: string) =>
      `${chatUrl()}/api/chatbots/${CHATBOT_ID}/threads/${threadId}/messages/${messageId}/feedback`

    const ownResponse = await page.request.post(
      feedbackUrl(ownThread.id, ownMessageId),
      { data: { rating: 'UP' } }
    )
    expect(ownResponse.status()).toBe(200)
    await expect.poll(() => getMessageRating(ownMessageId)).toBe('UP')

    const foreignResponse = await page.request.post(
      feedbackUrl(foreignThread.id, foreignMessageId),
      { data: { rating: 'UP' } }
    )
    expect(foreignResponse.status()).toBe(404)
    expect(await getMessageRating(foreignMessageId)).toBeNull()
  })

  test('Regenerating a response replaces it with a new one', async ({
    page,
  }) => {
    await seedThread(participantId, {
      title: 'Regenerate test',
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'Explain X' }] },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Seeded original answer' }],
        },
      ],
    })
    await visitChat(page)
    await page.getByTestId('chat-thread-select').first().click()

    const content = page.getByTestId('chat-assistant-message-content')
    await expect(content).toContainText('Seeded original answer')

    const assistant = page.getByTestId('chat-assistant-message')
    await assistant.hover()
    await page.getByTestId('chat-reload-message-button').click()

    await expect(content).toContainText('assistant reply #1', {
      timeout: 15_000,
    })
    await expect(content).not.toContainText('Seeded original answer')
  })

  test('Editing a non-root user message creates a new branch', async ({
    page,
  }) => {
    await visitChat(page)
    await sendMessage(page, 'First message')
    await expect(page.getByTestId('chat-assistant-message')).toBeVisible({
      timeout: 15_000,
    })
    await sendMessage(page, 'Second message')
    await expect(page.getByTestId('chat-assistant-message')).toHaveCount(2)

    const second = page
      .getByTestId('chat-user-message')
      .filter({ hasText: 'Second message' })
    await second.hover()
    await second.getByTestId('chat-edit-message-button').click()

    const editInput = page.getByTestId('chat-edit-composer-input')
    await expect(editInput).toBeVisible()
    await editInput.fill('Second edited')
    await page.getByTestId('chat-edit-send-button').click()

    await expect(
      page
        .getByTestId('chat-user-message-content')
        .filter({ hasText: 'Second edited' })
    ).toBeVisible()

    await page
      .getByTestId('chat-user-message')
      .filter({ hasText: 'Second edited' })
      .hover()
    await expect(page.getByTestId('chat-branch-picker').first()).toBeVisible()
    await expect(
      page.getByTestId('chat-branch-indicator').first()
    ).toContainText('/ 2')
    await expect(
      page.getByTestId('chat-branch-previous').first()
    ).toHaveAccessibleName('Previous version')
    await expect(
      page.getByTestId('chat-branch-next').first()
    ).toHaveAccessibleName('Next version')
  })

  test('Message tree: branches keep independent continuations and navigation restores them', async ({
    page,
  }) => {
    await visitChat(page)

    // Turn 1, then turn 2
    await sendMessage(page, 'root message')
    await expect(page.getByTestId('chat-assistant-message')).toBeVisible({
      timeout: 15_000,
    })
    await sendMessage(page, 'branch point')
    await expect(page.getByTestId('chat-assistant-message')).toHaveCount(2)

    const content = (text: string) =>
      page.getByTestId('chat-user-message-content').filter({ hasText: text })
    const branchPointMessage = () =>
      page
        .getByTestId('chat-user-message')
        .filter({ hasText: /branch point|branch B/ })

    // Edit turn 2 -> creates branch B (now active, 2/2)
    let msg = branchPointMessage()
    await msg.hover()
    await msg.getByTestId('chat-edit-message-button').click()
    await page.getByTestId('chat-edit-composer-input').fill('branch B')
    await page.getByTestId('chat-edit-send-button').click()
    await expect(content('branch B')).toBeVisible()

    // Continuation that exists ONLY in branch B
    await sendMessage(page, 'only in B')
    await expect(content('only in B')).toHaveCount(1)

    // Navigate the branch point back to branch A (1/2)
    msg = branchPointMessage()
    await msg.hover()
    await page.getByTestId('chat-branch-previous').first().click()

    // Branch A is active: original message shown, branch-B continuation gone
    await expect(content('branch point')).toBeVisible()
    await expect(content('only in B')).toHaveCount(0)

    // Continuation that exists ONLY in branch A
    await sendMessage(page, 'only in A')
    await expect(content('only in A')).toHaveCount(1)

    // Navigate back to branch B (2/2): its continuation returns, A's is gone
    msg = branchPointMessage()
    await msg.hover()
    await page.getByTestId('chat-branch-next').first().click()

    await expect(content('branch B')).toBeVisible()
    await expect(content('only in B')).toHaveCount(1)
    await expect(content('only in A')).toHaveCount(0)
  })

  // Regression guard for the root-edit branch fix: the edit must go through
  // the edit composer's own send (see thread.tsx:EditComposer) — submitting
  // via threadRuntime.append() collapses the root message's null parentId
  // and silently turns the edit into a new turn instead of a sibling branch.
  test('Editing the ROOT user message creates a new branch', async ({
    page,
  }) => {
    await visitChat(page)
    await sendMessage(page, 'Root prompt')
    await expect(page.getByTestId('chat-assistant-message')).toBeVisible({
      timeout: 15_000,
    })

    const rootMessage = page.getByTestId('chat-user-message').first()
    await rootMessage.hover()
    await rootMessage.getByTestId('chat-edit-message-button').click()

    const editInput = page.getByTestId('chat-edit-composer-input')
    await expect(editInput).toBeVisible()
    await editInput.fill('Root edited')
    await page.getByTestId('chat-edit-send-button').click()

    await expect(
      page
        .getByTestId('chat-user-message-content')
        .filter({ hasText: 'Root edited' })
    ).toBeVisible()

    await page
      .getByTestId('chat-user-message')
      .filter({ hasText: 'Root edited' })
      .hover()
    await expect(page.getByTestId('chat-branch-picker').first()).toBeVisible()
    await expect(
      page.getByTestId('chat-branch-indicator').first()
    ).toContainText('/ 2')
  })
})

// ===========================================================================
// Image Attachments
// ===========================================================================
test.describe('Chatbot Image Attachments', () => {
  let participantId: string

  test.beforeEach(async ({ page }) => {
    participantId = await getEnrolledParticipantId()
    await clearChatCookies(page)
    await setParticipantToken(page, participantId)
    await resetChatState(participantId)
    await setDisclaimerState(participantId, 'accepted')
    await mockChatStream(page)
  })

  test('Attaching an image shows a composer preview that can be removed', async ({
    page,
  }) => {
    await visitChat(page)
    await expect(page.getByTestId('chat-composer')).toBeVisible()

    await page
      .getByTestId('chat-composer-attach-input')
      .setInputFiles(testImageUpload())

    const preview = page.getByTestId('chat-composer-attachment')
    await expect(preview).toBeVisible()

    await preview.hover()
    await page.getByTestId('chat-attachment-remove').click()
    await expect(page.getByTestId('chat-composer-attachment')).toHaveCount(0)
  })

  test('Sending a message with an attachment shows it on the user message', async ({
    page,
  }) => {
    await visitChat(page)

    await page
      .getByTestId('chat-composer-attach-input')
      .setInputFiles(testImageUpload())
    await expect(page.getByTestId('chat-composer-attachment')).toBeVisible()

    await typeMessage(page, 'Here is an image')
    await page.getByTestId('chat-send-button').click()

    await expect(page.getByTestId('chat-user-message-content')).toContainText(
      'Here is an image'
    )
    await expect(
      page.getByTestId('chat-message-attachments').first()
    ).toBeVisible()
    await expect(
      page.getByTestId('chat-message-attachment').first()
    ).toBeVisible()
  })

  test('A stored message attachment renders and opens in the image viewer', async ({
    page,
  }) => {
    await seedThread(participantId, {
      title: 'Image thread',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Look at this' }],
          attachments: [
            {
              imageBase64: TEST_PNG_DATA_URL,
              imagePreviewBase64: TEST_PNG_DATA_URL,
              imageDescription: 'A tiny test image',
            },
          ],
        },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Nice image' }],
        },
      ],
    })
    await visitChat(page)
    await page.getByTestId('chat-thread-select').first().click()

    const tile = page.getByTestId('chat-message-attachment').first()
    await expect(tile).toBeVisible()

    // The reply to an image-bearing turn carries the localized activity chip.
    await expect(page.getByTestId('chat-image-analyzed')).toBeVisible()

    await tile.click()

    await expect(page.getByTestId('chat-image-viewer-image')).toBeVisible()
  })

  test('Attaching more than 3 images in composer is prevented', async ({
    page,
  }) => {
    await visitChat(page)

    const composer = page.getByTestId('chat-composer')

    await composer
      .getByTestId('chat-composer-attach-input')
      .setInputFiles([
        testImageUpload('image-1.png'),
        testImageUpload('image-2.png'),
        testImageUpload('image-3.png'),
        testImageUpload('image-4.png'),
      ])

    await expect(
      page.getByText('You can only attach up to 3 images.')
    ).toBeVisible()
    await expect(
      composer.getByTestId('chat-composer-attach-button')
    ).toHaveCount(0)
    await expect(composer.getByTestId('chat-composer-attachment')).toHaveCount(
      3
    )
  })

  test('Edit message attachment limit (3) is independent from new message limit', async ({
    page,
  }) => {
    await seedThread(participantId, {
      title: 'Edit attachment test',
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'Message to edit' }] },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Response' }],
        },
      ],
    })
    await visitChat(page)
    await page.getByTestId('chat-thread-select').first().click()

    // Edit the user message and attach 3 images
    const userMsg = page.getByTestId('chat-user-message').first()
    await userMsg.hover()
    await userMsg.getByTestId('chat-edit-message-button').click()

    const editComposer = page.getByTestId('chat-edit-composer')

    await editComposer
      .getByTestId('chat-edit-composer-attach-input')
      .setInputFiles([
        testImageUpload('edit-image-1.png'),
        testImageUpload('edit-image-2.png'),
        testImageUpload('edit-image-3.png'),
        testImageUpload('edit-image-4.png'),
      ])

    await expect(
      page.getByText('You can only attach up to 3 images.')
    ).toBeVisible()
    await expect(
      editComposer.getByTestId('chat-edit-composer-attach-button')
    ).toHaveCount(0)
    await expect(page.getByTestId('chat-composer-attach-button')).toHaveCount(1)
    await expect(
      editComposer.getByTestId('chat-composer-attachment')
    ).toHaveCount(3)

    // verify that the new message composer still allows 3 attachments
    await page
      .getByTestId('chat-composer')
      .getByTestId('chat-composer-attach-input')
      .setInputFiles([
        testImageUpload('new-image-1.png'),
        testImageUpload('new-image-2.png'),
        testImageUpload('new-image-3.png'),
      ])
    await expect(
      page.getByTestId('chat-composer').getByTestId('chat-composer-attachment')
    ).toHaveCount(3)
    await expect(page.getByTestId('chat-composer-attach-button')).toHaveCount(0)
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

  test('Mode switcher shows available modes', async ({ page }) => {
    await visitChat(page)

    await expect(page.getByTestId('chat-mode-switcher')).toBeVisible()
    await expect(page.getByTestId('chat-mode-option-tutor')).toContainText(
      'Tutor'
    )
    await expect(page.getByTestId('chat-mode-option-explainer')).toContainText(
      'Explainer'
    )
  })

  test('Selecting a different chat mode updates the selection', async ({
    page,
  }) => {
    await visitChat(page)

    const explainerOption = page.getByTestId('chat-mode-option-explainer')
    await explainerOption.click()
    await expect(explainerOption).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('chat-mode-option-tutor')).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  test('Mode switcher explains what each mode is for', async ({ page }) => {
    await visitChat(page)

    await page.getByTestId('chat-mode-option-tutor').hover()
    await expect(
      page.getByRole('tooltip').getByTestId('chat-mode-description-tutor')
    ).toContainText('patient')

    await page.getByTestId('chat-mode-option-explainer').hover()
    await expect(
      page.getByRole('tooltip').getByTestId('chat-mode-description-explainer')
    ).toContainText('difficult concepts')
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

    await openSettings(page)
    await expect(page.getByTestId('chat-model-selection')).toContainText(
      'GPT-4.1 Mini'
    )
  })

  test('Mobile keeps the credit balance and fallback notice outside the sidebar', async ({
    page,
  }) => {
    await setCredits(participantId, 0, 100)
    await page.setViewportSize({ width: 390, height: 844 })
    await visitChat(page)

    await expect(page.getByTestId('chat-mobile-credits-bar')).toBeVisible()
    await expect(page.getByTestId('chat-mobile-credits-display')).toContainText(
      '0 / 100'
    )
    await expect(page.getByTestId('chat-mobile-fallback-notice')).toContainText(
      'New messages use the smaller model'
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

  test('Model selection dropdown changes the model used for messages', async ({
    page,
  }) => {
    await setModelSelection(participantId, true)
    await mockChatStream(page)
    await visitChat(page)
    await openSettings(page)

    const modelSection = page.getByTestId('chat-model-selection')
    await expect(modelSection).toBeVisible()
    await expect(page.getByTestId('chat-model-display')).toHaveCount(0)

    await selectOption(page, '[data-cy="chat-model-select"]', 'GPT-4.1 Mini')
    await expect(modelSection).toContainText('GPT-4.1 Mini')

    const chatRequestPromise = page.waitForRequest(
      (request) =>
        request.method() === 'POST' &&
        request.url().includes(`/api/chatbots/${CHATBOT_ID}/chat`)
    )
    await sendMessage(page, 'Selected model check')

    const chatRequest = await chatRequestPromise
    const payload = chatRequest.postDataJSON() as { selectedModel?: string }
    expect(payload.selectedModel).toBe('gpt-4.1-mini')
    await expect(page.getByTestId('chat-assistant-message')).toContainText(
      'assistant reply #1',
      { timeout: 15_000 }
    )
  })

  test('Model descriptions explain capabilities without provider jargon', async ({
    page,
  }) => {
    await setModelSelection(participantId, true)
    await visitChat(page)
    await openSettings(page)

    const modelSection = page.getByTestId('chat-model-selection')
    await selectOption(page, '[data-cy="chat-model-select"]', 'GPT-5.6 Luna')

    await expect(modelSection).toContainText(
      'Built for difficult, multi-step questions'
    )
    await expect(modelSection).not.toContainText('LiteLLM')
    await expect(modelSection).not.toContainText('OpenAI reasoning model')
  })

  // The selector only appears for a model that supports reasoning with more
  // than one allowed effort, and the picked effort has to travel all the way
  // into the chat request — asserting the panel alone would pass even if the
  // selection never left the settings store.
  test('Reasoning effort selector is wired up when model selection is enabled', async ({
    page,
  }) => {
    await setModelSelection(participantId, true)
    await mockChatStream(page, {
      metadata: {
        chatMode: 'tutor',
        modelId: 'gpt-5.6-luna',
        reasoningEffort: 'high',
      },
    })
    await visitChat(page)
    await openSettings(page)

    await expect(page.getByTestId('chat-settings-panel')).toBeVisible()
    await expect(page.getByTestId('chat-model-selection')).toBeVisible()

    // Pick the non-reasoning model explicitly rather than relying on the
    // registry's default ordering (which varies per deployment), then assert
    // the effort selector is hidden for it.
    await selectOption(page, '[data-cy="chat-model-select"]', 'GPT-4.1')
    await expect(
      page.getByTestId('chat-reasoning-effort-selection')
    ).toHaveCount(0)
    await selectOption(page, '[data-cy="chat-model-select"]', 'GPT-5.6 Luna')

    await expect(
      page.getByTestId('chat-reasoning-effort-selection')
    ).toBeVisible()
    // Read the selected effort off the trigger, not the surrounding section:
    // the section's hint text ("Higher effort can improve...") would make a
    // "High" assertion pass before anything was selected.
    const effortSelect = page.getByTestId('chat-reasoning-effort-select')
    // "Medium" is the default this model resolves to, so "High" is a real
    // change rather than a no-op.
    await expect(effortSelect).toContainText('Medium')
    await selectOption(page, '[data-cy="chat-reasoning-effort-select"]', 'High')
    await expect(effortSelect).toContainText('High')

    const chatRequestPromise = page.waitForRequest(
      (request) =>
        request.method() === 'POST' &&
        request.url().includes(`/api/chatbots/${CHATBOT_ID}/chat`)
    )
    await sendMessage(page, 'Selected reasoning effort check')

    const chatRequest = await chatRequestPromise
    const payload = chatRequest.postDataJSON() as { reasoningEffort?: string }
    expect(payload.reasoningEffort).toBe('high')

    // The caption under the answer reflects the effort the stream reported.
    await expect(
      page.getByTestId('chat-assistant-message-content')
    ).toContainText('High', { timeout: 15_000 })
  })

  // S2: opening a thread by direct URL (bookmark/reload) must resync the
  // composer mode to that thread's own `lastChatMode`, not whatever mode was
  // last selected in this browser session.
  test('Direct URL load of a thread resyncs the composer mode to that thread', async ({
    page,
  }) => {
    const tutorThread = await seedThread(participantId, {
      title: 'Tutor thread',
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'A tutor question' }] },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'A tutor answer' }],
          chatMode: 'tutor',
        },
      ],
    })
    // A second thread so switching the composer mode below is not a no-op
    // against the tutor thread itself.
    await seedThread(participantId, { title: 'Other thread' })

    await visitChat(page)

    // Persist "explainer" as the session's selected mode (e.g. picked while
    // starting a new chat), independent of the tutor thread above.
    const explainerOption = page.getByTestId('chat-mode-option-explainer')
    await explainerOption.click()
    await expect(explainerOption).toHaveAttribute('aria-pressed', 'true')

    // Open the tutor thread via a direct URL load (bookmark/reload), not a
    // sidebar click.
    await page.goto(`${chatUrl()}/${CHATBOT_ID}/threads/${tutorThread.id}`, {
      waitUntil: 'domcontentloaded',
    })

    await expect(page.getByTestId('chat-mode-option-tutor')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect(
      page.getByTestId('chat-mode-option-explainer')
    ).toHaveAttribute('aria-pressed', 'false')
  })
})

// ===========================================================================
// History Rail
// ===========================================================================
test.describe('Chatbot History Rail', () => {
  let participantId: string

  test.beforeEach(async ({ page }) => {
    participantId = await getEnrolledParticipantId()
    await clearChatCookies(page)
    await setParticipantToken(page, participantId)
    await resetChatState(participantId)
    await setDisclaimerState(participantId, 'accepted')
  })

  test('pairs turns, keeps tool calls out of the rail, and navigates on desktop and mobile', async ({
    page,
  }) => {
    const firstUserId = '3f0c1a7e-4d2b-4a91-8f6c-2b7d1e5a9c50'
    const firstAssistantId = '3f0c1a7e-4d2b-4a91-8f6c-2b7d1e5a9c51'
    const secondUserId = '3f0c1a7e-4d2b-4a91-8f6c-2b7d1e5a9c52'
    const secondAssistantId = '3f0c1a7e-4d2b-4a91-8f6c-2b7d1e5a9c53'

    await seedThread(participantId, {
      title: 'History rail test',
      messages: [
        {
          id: firstUserId,
          role: 'user',
          content: [{ type: 'text', text: 'First rail question' }],
        },
        {
          id: firstAssistantId,
          role: 'assistant',
          content: [{ type: 'text', text: 'First rail answer' }],
        },
        {
          id: secondUserId,
          role: 'user',
          content: [{ type: 'text', text: 'Second rail question' }],
        },
        {
          id: secondAssistantId,
          role: 'assistant',
          content: [
            { type: 'text', text: 'Second rail answer' },
            {
              type: 'tool-call',
              toolCallId: 'history-rail-call-1',
              toolName: 'library_search',
              args: {},
              result: { content: [{ type: 'text', text: 'First result' }] },
            },
            {
              type: 'tool-call',
              toolCallId: 'history-rail-call-2',
              toolName: 'library_search',
              args: {},
              result: { content: [{ type: 'text', text: 'Second result' }] },
            },
          ],
        },
      ],
    })

    await visitChat(page)
    await page.getByTestId('chat-thread-select').first().click()

    const rail = page.locator('[data-cy="chat-history-rail"]')
    await expect(rail).toBeVisible()
    const ticks = rail.locator('[data-history-rail-tick]')
    await expect(ticks).toHaveCount(2)
    const toolGroupToggle = page.getByTestId('chat-tool-group-toggle')
    await expect(toolGroupToggle).toHaveCount(1)
    await expect(toolGroupToggle).toHaveAttribute('aria-expanded', 'false')

    await ticks.first().hover()
    const popover = page.getByTestId('chat-history-rail-turn-popover')
    await expect(popover).toContainText('First rail question')
    await expect(popover).toContainText('First rail answer')
    // Radix's hoverable tooltip closes on the pointermove that follows the
    // leave event: one synthetic move only fires the leave, so nudge the
    // pointer again to let the grace-area listener dismiss the popover.
    await page.mouse.move(0, 0)
    await page.mouse.move(1, 1)
    await expect(popover).toHaveCount(0)

    const currentTick = rail.locator('[aria-current="step"]')
    await expect(currentTick).toHaveCount(1)
    await currentTick.click()
    // Both the desktop and the mobile dialog mount while the history is open;
    // CSS hides the one outside the current breakpoint, so scope every dialog
    // locator to its rail container to keep strict mode unambiguous.
    const dialog = rail.locator('[data-history-rail-dialog]')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('[data-history-dialog-entry]')).toHaveCount(2)
    await dialog.locator('[data-history-dialog-entry]').first().click()
    await expect(
      page.locator(`[data-history-rail-anchor="message:${firstUserId}"]`)
    ).toBeFocused()

    // A second navigation issued right after the first jump must leave the
    // last-selected tick current; a stale scroll-spy callback must not win.
    // Navigating closes the dialog, so reopen it before picking the next row.
    await currentTick.click()
    await expect(dialog).toBeVisible()
    await dialog.locator('[data-history-dialog-entry]').nth(1).click()
    await expect(
      page.locator(`[data-history-rail-anchor="message:${secondUserId}"]`)
    ).toBeFocused()
    await expect(page.locator('[aria-current="step"]')).toHaveCount(1)

    // Close the desktop dialog with Escape; focus returns to the invoking tick.
    await currentTick.click()
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(currentTick).toBeFocused()

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(rail).toBeHidden()
    const mobileTrigger = page.getByTestId('chat-history-rail-mobile-trigger')
    await expect(mobileTrigger).toBeVisible()
    await expect(mobileTrigger).toContainText('/2')
    await mobileTrigger.click()
    const mobileDialog = page
      .getByTestId('chat-history-rail-mobile')
      .locator('[data-history-rail-dialog]')
    await expect(mobileDialog).toBeVisible()
    await expect(
      mobileDialog.locator('[data-history-dialog-entry]')
    ).toHaveCount(2)
    await mobileDialog.locator('[data-history-dialog-entry]').nth(1).click()
    await expect(
      page.locator(`[data-history-rail-anchor="message:${secondUserId}"]`)
    ).toBeFocused()
    // Close the mobile dialog with the 44px close button; focus returns to the
    // mobile trigger.
    await mobileTrigger.click()
    await expect(mobileDialog).toBeVisible()
    await mobileDialog
      .getByRole('button', { name: /close full history/i })
      .click()
    await expect(mobileDialog).toHaveCount(0)
    await expect(mobileTrigger).toBeFocused()
  })
})

// ===========================================================================
// Source Citations
// ===========================================================================
test.describe('Chatbot Source Citations', () => {
  let participantId: string

  test.beforeEach(async ({ page }) => {
    participantId = await getEnrolledParticipantId()
    await clearChatCookies(page)
    await setParticipantToken(page, participantId)
    await resetChatState(participantId)
    await setDisclaimerState(participantId, 'accepted')
  })

  type DocQuerySource = {
    file_name?: string
    source_url?: string
    source_type?: string
    page_number?: number
    expert?: string
  }

  /** A persisted doc_query tool-call part carrying the raw MCP CallToolResult
   * envelope (see `parseDocQueryPayload`): `result.content[0].text` is the
   * doc_query answer-mode JSON payload as a string. */
  function docQueryPart({
    toolCallId,
    toolName = 'KB_doc_query',
    sources,
  }: {
    toolCallId: string
    toolName?: string
    sources: DocQuerySource[]
  }) {
    return {
      type: 'tool-call' as const,
      toolCallId,
      toolName,
      args: { query: 'test query' },
      result: {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              answer: 'Course-material excerpt relevant to the question.',
              sources_used: sources.length,
              sources,
            }),
          },
        ],
      },
    }
  }

  type DocumentsModeSource = {
    reference: string
    reference_type: string
    source_type: string
    title: string
    chunks: Array<{
      content: string
      page_number?: number
      labeled_page_number?: string
    }>
  }

  function documentsQueryPart({
    toolCallId,
    sources,
  }: {
    toolCallId: string
    sources: DocumentsModeSource[]
  }) {
    return {
      type: 'tool-call' as const,
      toolCallId,
      toolName: 'KB_doc_query',
      args: { query: 'preview query' },
      result: {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ mode: 'documents', sources }),
          },
        ],
      },
    }
  }

  /** The same doc_query answer-mode payload as `docQueryPart`, but shaped as
   * the live `tool-output-available` output: the raw MCP CallToolResult
   * envelope the streaming parser stores as the tool result. */
  function docQueryToolOutput(sources: DocQuerySource[]) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            answer: 'Course-material excerpt relevant to the question.',
            sources_used: sources.length,
            sources,
          }),
        },
      ],
    }
  }

  function failedDocQueryPart(toolCallId: string) {
    return {
      type: 'tool-call' as const,
      toolCallId,
      toolName: 'KB_doc_query',
      args: { query: 'test query' },
      result: {
        content: [{ type: 'text', text: 'Tool execution failed' }],
        isError: true,
      },
    }
  }

  function genericToolPart(toolCallId: string) {
    return {
      type: 'tool-call' as const,
      toolCallId,
      toolName: 'library_search',
      args: { query: 'test query' },
      result: {
        content: [{ type: 'text', text: 'Some unrelated result' }],
      },
    }
  }

  /** Sets a message's `modelId` directly via Prisma. `seedThread`'s
   * `SeedMessage` type has no `modelId` field, so this mirrors the DB-level
   * write the app itself performs, the same way `chat.ts`'s own helpers
   * (e.g. `setCredits`) reach into Prisma for state the seed helper can't
   * express. */
  async function setMessageModelId(messageId: string, modelId: string) {
    const prisma = await getPrisma()
    await prisma.chatMessage.update({
      where: { id: messageId },
      data: { modelId },
    })
  }

  test('Sources section renders one card per unique source in first-appearance order with a count heading', async ({
    page,
  }) => {
    const messageId = '4a1b2c3d-0001-4a91-8f6c-2b7d1e5a9c40'
    await seedThread(participantId, {
      title: 'Sources order',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'What are the key facts?' }],
        },
        {
          id: messageId,
          role: 'assistant',
          content: [
            docQueryPart({
              toolCallId: 'call-1',
              sources: [
                {
                  file_name: 'Alpha Notes.pdf',
                  source_url: 'https://example.com/docs/alpha.pdf',
                  source_type: 'document',
                  page_number: 2,
                },
                {
                  file_name: 'Beta Notes.pdf',
                  source_url: 'https://example.com/docs/beta.pdf',
                  source_type: 'document',
                  page_number: 5,
                },
                {
                  file_name: 'Gamma Notes.pdf',
                  source_url: 'https://example.com/docs/gamma.pdf',
                  source_type: 'document',
                  page_number: 9,
                },
              ],
            }),
            { type: 'text', text: 'Here is a summary of the material.' },
          ],
        },
      ],
    })
    await visitChat(page)
    await page.getByTestId('chat-thread-select').first().click()

    const section = page.getByTestId('chat-sources-section')
    await expect(section).toBeVisible()
    await expect(section).toContainText('Sources · 3')
    await expect(page.getByTestId('chat-source-card')).toHaveCount(3)

    await expect(page.locator(`#src-${messageId}-1`)).toContainText(
      'Alpha Notes.pdf'
    )
    await expect(page.locator(`#src-${messageId}-2`)).toContainText(
      'Beta Notes.pdf'
    )
    await expect(page.locator(`#src-${messageId}-3`)).toContainText(
      'Gamma Notes.pdf'
    )
  })

  test('Source details stay in hover and focus previews for cards and citations', async ({
    page,
  }) => {
    const messageId = '4a1b2c3d-0013-4a91-8f6c-2b7d1e5a9c40'
    const excerpt =
      'This excerpt belongs in the source preview, not in the source card.'

    await seedThread(participantId, {
      title: 'Source previews',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Show the source details' }],
        },
        {
          id: messageId,
          role: 'assistant',
          content: [
            documentsQueryPart({
              toolCallId: 'call-preview',
              sources: [
                {
                  reference: 'preview-guide.pdf',
                  reference_type: 'pdf',
                  source_type: 'document',
                  title: 'Preview Guide.pdf',
                  chunks: [{ content: excerpt, page_number: 12 }],
                },
              ],
            }),
            { type: 'text', text: 'See [1] for the supporting passage.' },
          ],
        },
      ],
    })
    await visitChat(page)
    await page.getByTestId('chat-thread-select').first().click()

    const card = page.locator(`#src-${messageId}-1`)
    const openPreviews = page.getByRole('tooltip')
    await expect(card).toContainText('Preview Guide.pdf')
    await expect(card).toContainText('p. 12')
    await expect(card).not.toContainText(excerpt)
    await expect(openPreviews).toHaveCount(0)

    await card.hover()
    const preview = page.getByRole('tooltip').getByTestId('chat-source-preview')
    await expect(preview).toBeVisible()
    await expect(preview).toContainText(excerpt)
    await expect(preview).toContainText('p. 12')

    await page.mouse.move(0, 0)
    // Radix's hoverable tooltip closes on the pointermove that follows the
    // leave event: one synthetic move only fires the leave, so nudge the
    // pointer again to let the grace-area listener dismiss the popover.
    await page.mouse.move(1, 1)
    await expect(openPreviews).toHaveCount(0)

    await card.focus()
    await expect(preview).toBeVisible()

    const citation = page.getByTestId('chat-citation')
    await citation.focus()
    // Each source trigger owns an independent Radix tooltip root, so the
    // still-focused card tooltip and the newly opened citation tooltip can
    // be open at the same time; scope this part of the contract to the
    // citation tooltip itself instead of assuming global exclusivity.
    const citationTooltip = page
      .getByRole('tooltip')
      .filter({ hasText: 'Go to source' })
    await expect(citationTooltip).toBeVisible()
    await citation.hover()
    await expect(
      citationTooltip.getByTestId('chat-source-preview')
    ).toContainText(excerpt)
  })

  // Regression guard: a terminal assistant turn whose only content is a
  // completed source-bearing tool call (no answer text) must still surface
  // its source cards once the persisted thread is loaded.
  test('Completed tool-only turn shows source cards after thread selection', async ({
    page,
  }) => {
    await seedThread(participantId, {
      title: 'Tool-only sources',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Summarize the sources' }],
        },
        {
          role: 'assistant',
          content: [
            docQueryPart({
              toolCallId: 'call-tool-only',
              sources: [
                {
                  file_name: 'Terminal Only.pdf',
                  source_url: 'https://example.com/docs/terminal-only.pdf',
                  source_type: 'document',
                  page_number: 3,
                },
              ],
            }),
          ],
        },
      ],
    })
    await visitChat(page)
    await page.getByTestId('chat-thread-select').first().click()

    const section = page.getByTestId('chat-sources-section')
    await expect(section).toBeVisible()
    await expect(page.getByTestId('chat-source-card')).toHaveCount(1)
    await expect(section).toContainText('Terminal Only.pdf')
  })

  test('Two doc_query calls with an overlapping source dedupe into contiguous 1..N numbering', async ({
    page,
  }) => {
    const messageId = '4a1b2c3d-0002-4a91-8f6c-2b7d1e5a9c40'
    const sourceA: DocQuerySource = {
      file_name: 'Doc A.pdf',
      source_url: 'https://example.com/a.pdf',
      source_type: 'document',
      page_number: 1,
    }
    const sourceB: DocQuerySource = {
      file_name: 'Doc B.pdf',
      source_url: 'https://example.com/b.pdf',
      source_type: 'document',
      page_number: 4,
    }
    const sourceC: DocQuerySource = {
      file_name: 'Doc C.pdf',
      source_url: 'https://example.com/c.pdf',
      source_type: 'document',
      page_number: 7,
    }

    await seedThread(participantId, {
      title: 'Overlapping sources',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Search twice for related material' },
          ],
        },
        {
          id: messageId,
          role: 'assistant',
          content: [
            docQueryPart({ toolCallId: 'call-1', sources: [sourceA, sourceB] }),
            docQueryPart({ toolCallId: 'call-2', sources: [sourceB, sourceC] }),
            { type: 'text', text: 'Combined findings from both searches.' },
          ],
        },
      ],
    })
    await visitChat(page)
    await page.getByTestId('chat-thread-select').first().click()

    const section = page.getByTestId('chat-sources-section')
    await expect(section).toContainText('Sources · 3')
    await expect(page.getByTestId('chat-source-card')).toHaveCount(3)

    // Contiguous 1..3 numbering: B (seen in both calls) keeps its first
    // index and is not re-added, so C lands at 3, not 4.
    await expect(page.locator(`#src-${messageId}-1`)).toContainText('Doc A.pdf')
    await expect(page.locator(`#src-${messageId}-2`)).toContainText('Doc B.pdf')
    await expect(page.locator(`#src-${messageId}-3`)).toContainText('Doc C.pdf')
    await expect(page.locator(`#src-${messageId}-4`)).toHaveCount(0)
  })

  test('A valid [n] citation renders a citation chip/link while an out-of-range marker stays literal text', async ({
    page,
  }) => {
    await seedThread(participantId, {
      title: 'Citation markers',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Explain the concept' }],
        },
        {
          role: 'assistant',
          content: [
            docQueryPart({
              toolCallId: 'call-1',
              sources: [
                {
                  file_name: 'Testing Guide.pdf',
                  source_url: 'https://example.com/testing-guide.pdf',
                  source_type: 'document',
                  page_number: 1,
                },
              ],
            }),
            {
              type: 'text',
              text: 'See [1] for details, but [9] is undefined.',
            },
          ],
        },
      ],
    })
    await visitChat(page)
    await page.getByTestId('chat-thread-select').first().click()

    const citations = page.getByTestId('chat-citation')
    await expect(citations).toHaveCount(1)
    await expect(citations).toHaveAccessibleName('Source 1: Testing Guide.pdf')

    await expect(
      page.getByTestId('chat-assistant-message-content')
    ).toContainText('[9]')
  })

  test('Clicking a citation scrolls to its source without navigating or changing the URL hash', async ({
    page,
  }) => {
    await seedThread(participantId, {
      title: 'Citation click',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Explain the concept' }],
        },
        {
          role: 'assistant',
          content: [
            docQueryPart({
              toolCallId: 'call-1',
              sources: [
                {
                  file_name: 'Reference.pdf',
                  source_url: 'https://example.com/reference.pdf',
                  source_type: 'document',
                  page_number: 1,
                },
              ],
            }),
            { type: 'text', text: 'As shown in [1].' },
          ],
        },
      ],
    })
    await visitChat(page)
    await page.getByTestId('chat-thread-select').first().click()
    // Selecting a thread is itself a client-side navigation. Let it commit
    // before the baseline is taken, or the citation click gets blamed for a
    // URL change the router had already queued.
    await expect(page).toHaveURL(/\/threads\//)
    await expect(page.getByTestId('chat-citation')).toBeVisible()

    const urlBefore = page.url()
    const hashBefore = await page.evaluate(() => window.location.hash)

    await page.getByTestId('chat-citation').click()

    expect(page.url()).toBe(urlBefore)
    expect(await page.evaluate(() => window.location.hash)).toBe(hashBefore)
  })

  test('doc_query tool chip shows the exact label for each settled state and only the search icon for successful searches', async ({
    page,
  }) => {
    await seedThread(participantId, {
      title: 'Tool chip states',
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'Query 1' }] },
        {
          role: 'assistant',
          content: [
            docQueryPart({
              toolCallId: 'call-done',
              sources: [
                {
                  file_name: 'Material.pdf',
                  source_url: 'https://example.com/material.pdf',
                  source_type: 'document',
                  page_number: 3,
                },
              ],
            }),
          ],
        },
        { role: 'user', content: [{ type: 'text', text: 'Query 2' }] },
        {
          role: 'assistant',
          content: [docQueryPart({ toolCallId: 'call-empty', sources: [] })],
        },
        { role: 'user', content: [{ type: 'text', text: 'Query 3' }] },
        {
          role: 'assistant',
          content: [failedDocQueryPart('call-failed')],
        },
        { role: 'user', content: [{ type: 'text', text: 'Query 4' }] },
        {
          role: 'assistant',
          content: [genericToolPart('call-generic')],
        },
      ],
    })
    await visitChat(page)
    await page.getByTestId('chat-thread-select').first().click()

    const toggles = page.getByTestId('chat-tool-call-toggle')
    await expect(toggles).toHaveCount(4)

    const doneToggle = toggles.nth(0)
    const emptyToggle = toggles.nth(1)
    const failedToggle = toggles.nth(2)
    const genericToggle = toggles.nth(3)

    await expect(doneToggle).toHaveText('Searched course materials')
    await expect(emptyToggle).toHaveText(
      'Searched course materials · no results'
    )
    await expect(failedToggle).toHaveText('Course material search failed')
    await expect(genericToggle).toHaveText('Used search')

    await expect(doneToggle.locator('svg.lucide-search')).toHaveCount(1)
    await expect(emptyToggle.locator('svg.lucide-search')).toHaveCount(1)
    await expect(failedToggle.locator('svg.lucide-search')).toHaveCount(0)
    await expect(genericToggle.locator('svg.lucide-search')).toHaveCount(0)
  })

  // Every other citation test reads a persisted thread, where the tool result
  // arrives as stored JSON. This one goes through the streaming path instead
  // (`tool-output-available` -> `normalizeLiveToolOutput`), which is what a
  // student actually sees first.
  test('Citations and source cards render on a live streamed answer', async ({
    page,
  }) => {
    await mockChatStream(page, {
      text: 'Live answer citing [1] and also [2].',
      chunkDelayMs: 20,
      pauseAfterToolOutput: true,
      toolCalls: [
        {
          toolCallId: 'live-call-1',
          toolName: 'KB_doc_query',
          input: { query: 'live query' },
          output: docQueryToolOutput([
            {
              file_name: 'Live Alpha.pdf',
              source_url: 'https://example.com/live-alpha.pdf',
              source_type: 'document',
              page_number: 2,
            },
            {
              file_name: 'Live Beta.pdf',
              source_url: 'https://example.com/live-beta.pdf',
              source_type: 'document',
              page_number: 6,
            },
          ]),
        },
      ],
    })
    await visitChat(page)

    await sendMessage(page, 'Search the course materials')

    const section = page.getByTestId('chat-sources-section')
    await expect(page.getByTestId('chat-tool-call-toggle')).toHaveText(
      'Searched course materials',
      { timeout: 15_000 }
    )
    await expect(section).toHaveCount(0)
    await expect(page.getByText('Live answer citing')).toHaveCount(0)

    await page.evaluate(() => {
      const state = window as typeof window & {
        __releaseMockChatStream?: () => void
      }
      state.__releaseMockChatStream?.()
    })

    await expect(section).toBeVisible({ timeout: 15_000 })
    await expect(section).toContainText('Sources · 2')
    await expect(page.getByTestId('chat-source-card')).toHaveCount(2)

    const citations = page.getByTestId('chat-citation')
    await expect(citations).toHaveCount(2)
    await expect(citations.nth(0)).toHaveAccessibleName(
      'Source 1: Live Alpha.pdf'
    )
    await expect(citations.nth(1)).toHaveAccessibleName(
      'Source 2: Live Beta.pdf'
    )
  })

  test('Composer hint is visible in standalone mode and hidden when embedded', async ({
    page,
  }) => {
    await visitChat(page)

    await expect(page.getByTestId('chat-composer')).toBeVisible()
    await expect(page.getByTestId('chat-composer-hint')).toBeVisible()
    await expect(page.getByTestId('chat-composer-hint')).toHaveText(
      'Chatbot answers can be wrong — verify against your course materials.'
    )

    await page.goto(`${chatUrl()}/${CHATBOT_ID}?embed=true`, {
      waitUntil: 'domcontentloaded',
    })

    await expect(page.getByTestId('chat-composer')).toBeVisible()
    await expect(page.getByTestId('chat-composer-hint')).toHaveCount(0)
  })

  test('Assistant message caption exposes a parseable ISO timestamp', async ({
    page,
  }) => {
    await seedThread(participantId, {
      title: 'Timestamp test',
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'A question' }] },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'A timed answer' }],
        },
      ],
    })
    await visitChat(page)
    await page.getByTestId('chat-thread-select').first().click()

    const time = page
      .getByTestId('chat-assistant-message-content')
      .locator('time')
    await expect(time).toBeVisible()

    const datetime = await time.getAttribute('datetime')
    expect(datetime).toBeTruthy()
    expect(Number.isNaN(new Date(datetime as string).getTime())).toBe(false)
  })

  // Regression guard: an answer whose only custom metadata is `modelId` (no
  // chatMode/reasoningEffort/creditsUsed) must not render the aria-hidden
  // "visible parts" separator with nothing in front of it — see the
  // dangling-separator note in `MessageMetadata` (thread.tsx).
  test('Assistant message caption with only a modelId does not render a leading separator', async ({
    page,
  }) => {
    const messageId = '4a1b2c3d-0008-4a91-8f6c-2b7d1e5a9c40'
    await seedThread(participantId, {
      title: 'Model-only metadata',
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'A question' }] },
        {
          id: messageId,
          role: 'assistant',
          content: [{ type: 'text', text: 'A model-tagged answer' }],
        },
      ],
    })
    await setMessageModelId(messageId, 'gpt-4.1-mini')
    await visitChat(page)
    await page.getByTestId('chat-thread-select').first().click()

    const content = page.getByTestId('chat-assistant-message-content')
    await expect(content.locator('time')).toBeVisible()

    const visibleText = await content.innerText()
    const lastLine = visibleText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .pop()

    expect(lastLine).toBeTruthy()
    expect(lastLine?.startsWith('—')).toBe(false)
  })
})

// ===========================================================================
// Streamed Answer Metadata & Failure States
// ===========================================================================
// These exercise the live streaming path (`hooks/useChatResponse.ts`) rather
// than a persisted thread: the mocked SSE stream carries the same `finish`
// metadata and `error` parts the real route emits.
test.describe('Chatbot Streamed Answer Metadata & Failure States', () => {
  let participantId: string

  test.beforeEach(async ({ page }) => {
    participantId = await getEnrolledParticipantId()
    await clearChatCookies(page)
    await setParticipantToken(page, participantId)
    await resetChatState(participantId)
    await setDisclaimerState(participantId, 'accepted')
  })

  test('Heading-rich answers keep hierarchy and conversation scale', async ({
    page,
  }) => {
    await mockChatStream(page, {
      text: '# Main heading\n\n## Supporting heading\n\n### Detail heading\n\n#### Fourth heading\n\n##### Fifth heading\n\n###### Sixth heading',
    })
    await visitChat(page)

    await sendMessage(page, 'Show me a structured answer')

    const content = page.getByTestId('chat-assistant-message-content')
    await expect(content.locator('h2')).toContainText('Main heading', {
      timeout: 15_000,
    })
    await expect(content.locator('h3')).toContainText('Supporting heading')
    await expect(content.locator('h4')).toContainText('Detail heading')
    await expect(content.locator('h5')).toContainText('Fourth heading')
    await expect(content.locator('h6')).toContainText('Fifth heading')
    await expect(
      content.locator('[role="heading"][aria-level="7"]')
    ).toContainText('Sixth heading')

    const headingSelector =
      'h2, h3, h4, h5, h6, [role="heading"][aria-level="7"]'
    const readHeadingSizes = () =>
      content
        .locator(headingSelector)
        .evaluateAll((headings) =>
          headings.map((heading) =>
            Number.parseFloat(getComputedStyle(heading).fontSize)
          )
        )
    const assertHeadingScale = (headingSizes: number[]) => {
      expect(headingSizes).toHaveLength(6)
      for (let index = 1; index < headingSizes.length; index += 1) {
        expect(headingSizes[index - 1]).toBeGreaterThan(headingSizes[index])
      }
      expect(Math.max(...headingSizes)).toBeLessThan(36)
    }

    assertHeadingScale(await readHeadingSizes())

    await page.setViewportSize({ width: 390, height: 844 })
    assertHeadingScale(await readHeadingSizes())
  })

  test('Caption under a streamed answer shows the mode and credit cost', async ({
    page,
  }) => {
    await mockChatStream(page, {
      metadata: {
        chatMode: 'explainer',
        modelId: 'gpt-4.1-mini',
        reasoningEffort: 'medium',
        creditsUsed: 0.5,
      },
    })
    await visitChat(page)

    const explainerOption = page.getByTestId('chat-mode-option-explainer')
    await explainerOption.click()
    await expect(explainerOption).toHaveAttribute('aria-pressed', 'true')

    await sendMessage(page, 'What does the caption say?')

    const content = page.getByTestId('chat-assistant-message-content')
    await expect(content).toContainText('assistant reply #1', {
      timeout: 15_000,
    })
    await expect(content).toContainText('Explainer')
    await expect(content).toContainText('Medium')
    // `creditsUsed` 0.5 renders through `formatCredits` + the plural message.
    await expect(content).toContainText('0.5 credits')

    // The sidebar row picks up the same mode (D6). Scope to the first row and
    // wait for it: the row itself depends on the unmocked thread round-trip,
    // unlike the instantly-mocked stream above.
    const threadRow = page.getByTestId('chat-thread-select').first()
    await expect(threadRow).toBeVisible()
    await expect(threadRow.getByTestId('chat-thread-mode')).toContainText(
      'Explainer'
    )
  })

  // A renderer regression here shows an empty bubble while CI stays green, so
  // assert the callout has actual text and not just a node.
  test('A stream error renders the error callout with visible text', async ({
    page,
  }) => {
    await mockChatStream(page, {
      text: 'Partial answer before the failure.',
      errorText: 'upstream provider failed',
    })
    await visitChat(page)

    await sendMessage(page, 'Trigger a stream error')

    const callout = page.getByTestId('chat-message-error')
    await expect(callout).toBeVisible({ timeout: 15_000 })
    await expect(callout).toContainText('Error')
    await expect(callout).toContainText('something went wrong')
    expect((await callout.innerText()).trim().length).toBeGreaterThan(0)

    // The text streamed before the error is kept alongside the callout.
    await expect(
      page.getByTestId('chat-assistant-message-content')
    ).toContainText('Partial answer before the failure.')

    const assistant = page.getByTestId('chat-assistant-message').last()
    await expect(
      assistant.getByTestId('chat-reload-message-button')
    ).toHaveCount(0)
    await expect(assistant.getByTestId('chat-rate-up-button')).toHaveCount(0)
    await expect(assistant.getByTestId('chat-rate-down-button')).toHaveCount(0)
    await expect(assistant.locator('time')).toHaveCount(0)
  })

  test('A silent stream interruption keeps failed-turn actions suppressed', async ({
    page,
  }) => {
    await mockChatStream(page, {
      text: 'Partial answer before the connection closed.',
      omitFinish: true,
    })
    await visitChat(page)

    await sendMessage(page, 'Trigger a silent interruption')

    const callout = page.getByTestId('chat-message-error')
    await expect(callout).toBeVisible({ timeout: 15_000 })
    await expect(callout).toContainText('Connection interrupted')
    await expect(callout.getByTestId('chat-retry-message-button')).toBeVisible()

    const assistant = page.getByTestId('chat-assistant-message').last()
    await expect(
      assistant.getByTestId('chat-reload-message-button')
    ).toHaveCount(0)
    await expect(assistant.getByTestId('chat-rate-up-button')).toHaveCount(0)
    await expect(assistant.getByTestId('chat-rate-down-button')).toHaveCount(0)
    await expect(assistant.locator('time')).toHaveCount(0)
  })

  test('A length-truncated answer appends the truncation notice', async ({
    page,
  }) => {
    await mockChatStream(page, {
      text: 'An answer that ran out of',
      metadata: { finishReason: 'length', chatMode: 'tutor' },
    })
    await visitChat(page)

    await sendMessage(page, 'Give me a very long answer')

    const content = page.getByTestId('chat-assistant-message-content')
    await expect(content).toContainText('An answer that ran out of', {
      timeout: 15_000,
    })
    await expect(content).toContainText('Response truncated')
    await expect(page.getByTestId('chat-message-error')).toHaveCount(0)
  })
})
