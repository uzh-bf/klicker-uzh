import { COURSE_ID_TEST, URL_MANAGE } from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'
import {
  collectWindowMessages,
  DEFAULT_CONFIRMED_ELEMENT,
  getWindowMessages,
  makeProposalEnvelope,
  mockManageChatStream,
  mockManageProposalConfirm,
  openManageAssistantWidget,
  sendManageAssistantMessage,
} from '../util/manageAssistant.js'

/**
 * Manage assistant (apps/chat `/manage`, embedded via
 * ManageAssistantWidget in apps/frontend-manage) E2E
 *
 * - lecturer is authenticated through the shared `next-auth.session-token`
 *   cookie set on the Manage origin; the widget's iframe lives on the Chat
 *   origin and is driven through the real postMessage handshake (manage
 *   context in, `klicker:manage-element-created` out) rather than mocked.
 * - POST /api/manage/chat and POST /api/manage/proposals/confirm are mocked;
 *   everything else (widget open/close, context handoff, suggestions,
 *   proposal card, toast) runs through the real app.
 */

test.describe('Manage Assistant — Messaging', () => {
  test.beforeEach(async ({ loginLecturer, page }) => {
    // Must be registered before the first navigation (inside loginLecturer)
    // so it is present for every later page.
    await collectWindowMessages(page)
    await loginLecturer()
  })

  test('Plain text stream response renders an assistant text bubble', async ({
    page,
  }) => {
    await mockManageChatStream(page, {
      text: 'Sure — here is a summary of your course.',
    })
    const assistant = await openManageAssistantWidget(page)

    await sendManageAssistantMessage(assistant, 'Summarize my course')

    await expect(assistant.getByTestId('chat-assistant-message')).toBeVisible({
      timeout: 15_000,
    })
    await expect(
      assistant.getByTestId('chat-assistant-message-content')
    ).toContainText('Sure — here is a summary of your course.')
  })

  test('A signed proposal tool call renders an auto-expanded proposal card with the question preview', async ({
    page,
  }) => {
    await mockManageChatStream(page, { mode: 'proposal' })
    const assistant = await openManageAssistantWidget(page)

    await sendManageAssistantMessage(
      assistant,
      'Draft a question about mitochondria'
    )

    await expect(assistant.getByTestId('chat-assistant-message')).toBeVisible({
      timeout: 15_000,
    })

    // The proposal card renders fully expanded as soon as the tool result
    // arrives — unlike the generic ToolFallback (collapsed behind a
    // click-to-expand toggle), it never needs an explicit expand action.
    await expect(assistant.getByText('Confirmation required')).toBeVisible()
    await expect(
      assistant.getByText('New single-choice question ready for review')
    ).toBeVisible()

    // Real question preview (StudentElement), rendered from the signed
    // proposal payload. Scope to the preview's testids so the assertions do not
    // also match the card's collapsible "Show raw JSON" block, whose serialized
    // payload contains the same strings.
    await expect(
      assistant.getByTestId('instance-question-content')
    ).toContainText('What is the powerhouse of the cell?')
    await expect(assistant.getByTestId('sc-0-answer-option-0')).toContainText(
      'Mitochondria'
    )
    await expect(assistant.getByTestId('sc-0-answer-option-1')).toContainText(
      'Nucleus'
    )

    await expect(
      assistant.getByRole('button', { name: 'Create draft' })
    ).toBeEnabled()
  })

  test('Confirming a proposal shows a success state and notifies the manage parent window', async ({
    page,
  }) => {
    await mockManageChatStream(page, { mode: 'proposal' })
    await mockManageProposalConfirm(page)
    const assistant = await openManageAssistantWidget(page)

    await sendManageAssistantMessage(
      assistant,
      'Draft a question about mitochondria'
    )

    const confirmButton = assistant.getByRole('button', {
      name: 'Create draft',
    })
    await expect(confirmButton).toBeEnabled()
    await confirmButton.click()

    await expect(
      assistant.getByText('Draft created in the question pool')
    ).toBeVisible()
    await expect(
      assistant.getByText(
        `${DEFAULT_CONFIRMED_ELEMENT.name} (#${DEFAULT_CONFIRMED_ELEMENT.id})`
      )
    ).toBeVisible()

    // The confirmed-element payload crosses the iframe boundary as a
    // `klicker:manage-element-created` postMessage to the top-level manage
    // window (see manageParentNotify.ts / manageElementCreatedMessage.ts).
    await expect(async () => {
      const messages = (await getWindowMessages(page)) as {
        data?: { type?: string; payload?: unknown }
      }[]
      const created = messages.find(
        (m) => m.data?.type === 'klicker:manage-element-created'
      )
      expect(created?.data?.payload).toMatchObject(DEFAULT_CONFIRMED_ELEMENT)
    }).toPass({ timeout: 10_000 })

    // Bonus: the design-system success toast rendered on the manage page
    // itself once ManageAssistantWidget handles the message.
    await expect(
      page.getByText(
        `Draft "${DEFAULT_CONFIRMED_ELEMENT.name}" added to your question pool`
      )
    ).toBeVisible()
  })

  test('Welcome message explains assistant capabilities and limits', async ({
    page,
  }) => {
    await mockManageChatStream(page)
    const assistant = await openManageAssistantWidget(page)

    const welcome = assistant.getByTestId('chat-welcome-message')
    await expect(welcome).toBeVisible()
    await expect(welcome).toContainText('Hello! How can I help you?')
    await expect(welcome).toContainText('Search your courses and question pool')
    await expect(welcome).toContainText(
      'Draft single-choice, multiple-choice, and free-text questions'
    )
    await expect(welcome).toContainText(
      'Suggest improvements to question feedback'
    )
    await expect(welcome).toContainText('Read-only for everything else')
  })
})

test.describe('Manage Assistant — Per-surface suggestions', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  test('Question pool (library) shows question-pool suggestions', async ({
    page,
  }) => {
    await mockManageChatStream(page)
    const assistant = await openManageAssistantWidget(page)
    const welcome = assistant.getByTestId('chat-welcome-message')

    for (const text of [
      'Draft a question',
      'Find questions',
      'Improve feedback',
    ]) {
      await expect(welcome.getByText(text, { exact: true })).toBeVisible()
    }

    // Course-dashboard-only suggestions must not leak into this surface.
    await expect(
      welcome.getByText('Summarize this course', { exact: true })
    ).toHaveCount(0)
  })

  test('Course dashboard shows course-dashboard suggestions', async ({
    page,
  }) => {
    await mockManageChatStream(page)
    await page.goto(
      `${process.env.URL_MANAGE ?? URL_MANAGE}/courses/${COURSE_ID_TEST}`
    )

    const assistant = await openManageAssistantWidget(page)
    const welcome = assistant.getByTestId('chat-welcome-message')

    // The course-dashboard set only replaces the default suggestions once the
    // parent → iframe manage-context handshake completes, which races the
    // widget opening — allow extra time for that async update to settle.
    for (const text of [
      'Summarize this course',
      'Draft course question',
      'Find course material',
    ]) {
      await expect(welcome.getByText(text, { exact: true })).toBeVisible({
        timeout: 15_000,
      })
    }

    // Question-pool-only suggestions must not leak into this surface (retries
    // until the handshake has swapped the default set out).
    await expect(
      welcome.getByText('Draft a question', { exact: true })
    ).toHaveCount(0)
  })
})

test.describe('Manage Assistant — Error paths', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  test('Proposal confirm rejected with 403 (tampered token) shows an error state and creates no draft', async ({
    page,
  }) => {
    await mockManageChatStream(page, { mode: 'proposal' })
    await mockManageProposalConfirm(page, {
      error: 'This proposal is no longer valid. Please ask again.',
      status: 403,
    })
    const assistant = await openManageAssistantWidget(page)

    await sendManageAssistantMessage(
      assistant,
      'Draft a question about mitochondria'
    )

    const confirmButton = assistant.getByRole('button', {
      name: 'Create draft',
    })
    await expect(confirmButton).toBeEnabled()
    await confirmButton.click()

    // Card renders confirmation.type === 'error' with the server's message
    // verbatim (manage-proposal-card.tsx confirmProposal()).
    await expect(
      assistant.getByText('This proposal is no longer valid. Please ask again.')
    ).toBeVisible()

    // No success state: the draft was never created.
    await expect(
      assistant.getByText('Draft created in the question pool')
    ).toHaveCount(0)
    await expect(
      assistant.getByText(
        `${DEFAULT_CONFIRMED_ELEMENT.name} (#${DEFAULT_CONFIRMED_ELEMENT.id})`
      )
    ).toHaveCount(0)

    // Widget stays interactive: an error (unlike success) does not remove the
    // "Create draft" button, and it re-enables so the lecturer can retry
    // instead of the card getting stuck.
    await expect(confirmButton).toBeEnabled()
  })

  test('Proposal confirm rejected with 401 (lost session) shows an error state', async ({
    page,
  }) => {
    await mockManageChatStream(page, { mode: 'proposal' })
    await mockManageProposalConfirm(page, {
      error: 'Your session has expired. Please sign in again.',
      status: 401,
    })
    const assistant = await openManageAssistantWidget(page)

    await sendManageAssistantMessage(
      assistant,
      'Draft a question about mitochondria'
    )

    const confirmButton = assistant.getByRole('button', {
      name: 'Create draft',
    })
    await expect(confirmButton).toBeEnabled()
    await confirmButton.click()

    await expect(
      assistant.getByText('Your session has expired. Please sign in again.')
    ).toBeVisible()
    await expect(
      assistant.getByText('Draft created in the question pool')
    ).toHaveCount(0)
    await expect(confirmButton).toBeEnabled()
  })

  // Thread.tsx does not currently wire MessagePrimitive.Error /
  // ErrorPrimitive.Message anywhere in the manage assistant's message list,
  // so a failed chat stream renders no dedicated error text/toast today (see
  // apps/chat/src/components/thread.tsx AssistantMessage /
  // MessagePrimitive.Unstable_PartsGrouped — no Error component is passed).
  // The AI SDK still reliably takes the thread out of its "running" state on
  // any stream failure (Chat's send loop in the `ai` package catches the
  // error and sets status: 'error', which useAISDKRuntime does not count as
  // busy — see manageAssistant.ts errorStreamFulfillment for the source
  // trace), so the strongest true, user-visible invariant here is: the
  // widget does not get stuck, does not crash, and accepts another message.
  test('Chat stream failing mid-stream does not crash the widget and a retry succeeds', async ({
    page,
  }) => {
    await mockManageChatStream(page, {
      errorMode: 'stream-error',
      text: 'Second reply after recovery.',
    })
    const assistant = await openManageAssistantWidget(page)

    await sendManageAssistantMessage(assistant, 'Summarize my course')

    // Recovers: the composer returns to its normal "send" affordance instead
    // of hanging in a permanently "running"/cancel state.
    await expect(assistant.getByTestId('chat-send-button')).toBeVisible({
      timeout: 15_000,
    })
    await expect(assistant.getByTestId('chat-composer-input')).toBeEditable()

    // Widget is still usable: sending a new message gets a full, normal reply.
    await sendManageAssistantMessage(assistant, 'Try again')
    await expect(
      assistant.getByTestId('chat-assistant-message-content').last()
    ).toContainText('Second reply after recovery.', { timeout: 15_000 })
  })

  test('Malformed stream envelope does not crash the widget and a retry succeeds', async ({
    page,
  }) => {
    await mockManageChatStream(page, {
      errorMode: 'malformed',
      text: 'Second reply after recovery.',
    })
    const assistant = await openManageAssistantWidget(page)

    await sendManageAssistantMessage(assistant, 'Summarize my course')

    await expect(assistant.getByTestId('chat-send-button')).toBeVisible({
      timeout: 15_000,
    })
    await expect(assistant.getByTestId('chat-composer-input')).toBeEditable()

    // The malformed chunk fails to parse before any content is ever applied
    // to a message (DefaultChatTransport throws before processUIMessageStream
    // sees a single valid chunk), so no assistant bubble should exist yet.
    await expect(assistant.getByTestId('chat-assistant-message')).toHaveCount(0)

    await sendManageAssistantMessage(assistant, 'Try again')
    await expect(
      assistant.getByTestId('chat-assistant-message-content').last()
    ).toContainText('Second reply after recovery.', { timeout: 15_000 })
  })
})

// Sanity check that makeProposalEnvelope produces the exact
// {kind, proposalToken, summary, requiresConfirmation, payload} shape
// documented in apps/chat/test/manage-proposal-card.test.ts.
test('makeProposalEnvelope shape matches the signed proposal envelope', () => {
  const envelope = makeProposalEnvelope()
  expect(envelope.kind).toBe('element.create.proposal')
  expect(envelope.requiresConfirmation).toBe(true)
  expect(typeof envelope.proposalToken).toBe('string')
  expect(typeof envelope.summary).toBe('string')
  expect(envelope.payload).toBeTruthy()
})
