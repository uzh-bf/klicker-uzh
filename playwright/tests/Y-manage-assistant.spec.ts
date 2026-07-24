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
