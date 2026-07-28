import { COURSE_ID_TEST, URL_MANAGE } from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'
import {
  collectWindowMessages,
  DEFAULT_CONFIRMED_ELEMENT,
  delayChatIframeScripts,
  getWindowMessages,
  makeProposalEnvelope,
  mockManageChatStream,
  mockManageProposalConfirm,
  openManageAssistantWidget,
  sendManageAssistantMessage,
  trackProposalConfirmRequests,
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

  test('Dismissing a proposal collapses the card into a muted note and fires no confirm request', async ({
    page,
  }) => {
    await mockManageChatStream(page, { mode: 'proposal' })
    const getConfirmRequestCount = await trackProposalConfirmRequests(page)
    const assistant = await openManageAssistantWidget(page)

    await sendManageAssistantMessage(
      assistant,
      'Draft a question about mitochondria'
    )

    const dismissButton = assistant.getByTestId(
      'chat-manage-proposal-dismiss-button'
    )
    await expect(dismissButton).toBeEnabled()
    await dismissButton.click()

    // Dismissed is terminal: the full card (header, preview, actions) is
    // replaced by the collapsed muted note (see applyDismiss /
    // manage-proposal-card.tsx), and the confirm/dismiss actions are gone
    // with it.
    await expect(
      assistant.getByTestId('chat-manage-proposal-dismissed')
    ).toBeVisible()
    await expect(assistant.getByText('Confirmation required')).toHaveCount(0)
    await expect(dismissButton).toHaveCount(0)

    // No draft was ever created: dismissing is local-only and never calls
    // the confirm endpoint.
    expect(getConfirmRequestCount()).toBe(0)
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
    await expect(
      welcome.getByText(/Read-only for everything else/)
    ).toHaveClass(/(^|\s)text-muted-foreground(\s|$)/)
  })

  test('Dialog exposes modal semantics and isolates the Manage page', async ({
    page,
  }) => {
    await mockManageChatStream(page)

    const trigger = page.getByTestId('manage-assistant-open')
    await expect(trigger).toHaveAttribute(
      'aria-controls',
      'manage-assistant-dialog'
    )
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')

    await openManageAssistantWidget(page)

    const dialog = page.getByTestId('manage-assistant-drawer')
    await expect(dialog).toHaveAttribute('id', 'manage-assistant-dialog')
    await expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(await dialog.evaluate((element) => element.tagName)).toBe('DIV')
    expect(
      await dialog.evaluate((element) => element.closest('#__app') === null)
    ).toBe(true)

    const appRoot = page.locator('#__app')
    await expect(appRoot).toHaveAttribute('aria-hidden', 'true')
    expect(
      await appRoot.evaluate((element) => (element as HTMLElement).inert)
    ).toBe(true)

    await dialog.getByRole('button', { name: 'Close' }).click()

    await expect(dialog).toHaveCount(0)
    await expect(appRoot).not.toHaveAttribute('aria-hidden', 'true')
    expect(
      await appRoot.evaluate((element) => (element as HTMLElement).inert)
    ).toBe(false)
    await expect(trigger).toBeFocused()
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

test.describe('Manage Assistant — Slow hydration', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  test('Manage context still arrives when the chat iframe hydrates slowly, via the ready→resend handshake alone', async ({
    page,
  }) => {
    await mockManageChatStream(page)
    await page.goto(
      `${process.env.URL_MANAGE ?? URL_MANAGE}/courses/${COURSE_ID_TEST}`
    )

    // Stretch the iframe's own script fetches well past its `load` event, so
    // ManageAssistantWidget's send-on-frameLoaded post races ahead of the
    // not-yet-mounted useEmbeddedManageContext listener and is dropped. The
    // course-dashboard suggestions below only ever replace the defaults once
    // the manage context lands, so this proves the iframe's own
    // `klicker:manage-context-ready` ping — and the parent's resend on that
    // ping — is what delivers it, with no timed retry burst involved.
    await delayChatIframeScripts(page, 1_000)

    const assistant = await openManageAssistantWidget(page)
    const welcome = assistant.getByTestId('chat-welcome-message')

    for (const text of [
      'Summarize this course',
      'Draft course question',
      'Find course material',
    ]) {
      await expect(welcome.getByText(text, { exact: true })).toBeVisible({
        timeout: 20_000,
      })
    }

    // Question-pool-only suggestions must not leak in: the default set was
    // never the one actually shown, confirming the swap really happened.
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

  for (const routeFailure of [
    {
      errorMode: 'http-401' as const,
      rawMessage: 'Unauthorized',
      status: 401,
    },
    {
      errorMode: 'http-429' as const,
      rawMessage: 'Too many requests',
      status: 429,
    },
  ]) {
    test(`Chat route ${routeFailure.status} shows only the generic UI error and recovers`, async ({
      page,
    }) => {
      await mockManageChatStream(page, {
        errorMode: routeFailure.errorMode,
        text: 'Second reply after recovery.',
      })
      const assistant = await openManageAssistantWidget(page)

      await sendManageAssistantMessage(assistant, 'Summarize my course')

      const error = assistant.getByTestId('chat-assistant-message-error')
      await expect(error).toBeVisible({ timeout: 15_000 })
      await expect(error).toHaveText('Something went wrong. Please try again.')

      const transcript = assistant.getByTestId('chat-thread')
      await expect(transcript).not.toContainText(routeFailure.rawMessage)
      await expect(transcript).not.toContainText('{"error"')
      await expect(transcript).not.toContainText('node_modules')
      await expect(transcript).not.toContainText('at /app/')

      await expect(assistant.getByTestId('chat-send-button')).toBeVisible({
        timeout: 15_000,
      })
      await expect(assistant.getByTestId('chat-composer-input')).toBeEditable()

      await sendManageAssistantMessage(assistant, 'Try again')
      await expect(
        assistant.getByTestId('chat-assistant-message-content').last()
      ).toContainText('Second reply after recovery.', { timeout: 15_000 })
    })
  }

  // Thread.tsx wires MessagePrimitive.Error / ErrorPrimitive.Message as
  // AssistantMessageError (see apps/chat/src/components/thread.tsx), so a
  // failed chat stream now renders a dedicated inline error note instead of
  // stopping silently. The AI SDK still reliably takes the thread out of its
  // "running" state on any stream failure (Chat's send loop in the `ai`
  // package catches the error and sets status: 'error', which
  // useAISDKRuntime does not count as busy — see manageAssistant.ts
  // errorStreamFulfillment for the source trace), so this also asserts the
  // widget does not get stuck, does not crash, and accepts another message.
  test('Chat stream failing mid-stream shows a visible error note and a retry succeeds', async ({
    page,
  }) => {
    await mockManageChatStream(page, {
      errorMode: 'stream-error',
      text: 'Second reply after recovery.',
    })
    const assistant = await openManageAssistantWidget(page)

    await sendManageAssistantMessage(assistant, 'Summarize my course')

    // The partial reply already streamed keeps its content, but the message
    // is left in status: {type: "incomplete", reason: "error"} (see `ai`'s
    // getAutoStatus, applied to the last message when chat.error is set) —
    // AssistantMessageError renders for that exact state.
    await expect(
      assistant.getByTestId('chat-assistant-message-error')
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      assistant.getByTestId('chat-assistant-message-content')
    ).toContainText('Partial answer before the connection dropped.')

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

  test('Malformed stream envelope shows a visible error note and a retry succeeds', async ({
    page,
  }) => {
    await mockManageChatStream(page, {
      errorMode: 'malformed',
      text: 'Second reply after recovery.',
    })
    const assistant = await openManageAssistantWidget(page)

    await sendManageAssistantMessage(assistant, 'Summarize my course')

    // The malformed chunk fails to parse before any real content is ever
    // applied to a message (DefaultChatTransport throws before
    // processUIMessageStream sees a single valid chunk) — but the pipeline
    // still synthesizes an empty assistant message carrying the error status
    // rather than leaving the turn with no assistant message at all: see
    // createErrorAssistantMessage in @assistant-ui/core's
    // external-message-converter.js, which pushes
    // {role: "assistant", content: [], status: {type: "incomplete", reason:
    // "error", error}} whenever chat.error is set and the last converted
    // message is not already an assistant message. So exactly one
    // chat-assistant-message renders here, with no text content of its own,
    // and the same AssistantMessageError note as the mid-stream case.
    await expect(assistant.getByTestId('chat-assistant-message')).toHaveCount(1)
    await expect(
      assistant.getByTestId('chat-assistant-message-error')
    ).toBeVisible({ timeout: 15_000 })

    await expect(assistant.getByTestId('chat-send-button')).toBeVisible({
      timeout: 15_000,
    })
    await expect(assistant.getByTestId('chat-composer-input')).toBeEditable()

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
