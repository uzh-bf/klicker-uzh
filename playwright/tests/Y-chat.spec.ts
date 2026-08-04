import { expect, test, type Page } from '@playwright/test'
import { getPrisma } from '../global-setup.js'
import {
  CHATBOT_ID,
  chatUrl,
  clearChatCookies,
  getEnrolledParticipantId,
  getMessageRating,
  mockChatStream,
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

    await up.click()
    await expect(up).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => getMessageRating(assistantMessageId)).toBe('UP')

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

  test('Reasoning effort selector is wired up when model selection is enabled', async ({
    page,
  }) => {
    await setModelSelection(participantId, true)
    await visitChat(page)
    await openSettings(page)

    await expect(page.getByTestId('chat-settings-panel')).toBeVisible()
    await expect(page.getByTestId('chat-model-selection')).toBeVisible()
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

  test('A valid [n] citation renders a citation button while an out-of-range marker stays literal text', async ({
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
