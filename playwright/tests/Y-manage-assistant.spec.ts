import { testImageUpload } from '../util/chat.js'
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

    // Static lecturer review rendered from the signed proposal payload. It
    // exposes correctness and feedback before the draft is created.
    await expect(
      assistant.getByTestId('chat-manage-proposal-question')
    ).toContainText('What is the powerhouse of the cell?')
    const options = assistant.getByTestId('chat-manage-proposal-option')
    await expect(options).toHaveCount(2)
    await expect(options.nth(0)).toContainText('Mitochondria')
    await expect(options.nth(0)).toContainText('Correct')
    await expect(options.nth(0)).toContainText(
      'Correct: mitochondria generate most cellular ATP.'
    )
    await expect(options.nth(1)).toContainText('Nucleus')
    await expect(options.nth(1)).toContainText('Incorrect')
    await expect(options.nth(1)).toContainText(
      'The nucleus stores DNA but is not the cellular powerhouse.'
    )

    const createDraft = assistant.getByRole('button', { name: 'Create draft' })
    await expect(createDraft).toBeEnabled()

    const createDraftBox = await createDraft.boundingBox()
    const composerBox = await assistant
      .getByTestId('chat-composer')
      .boundingBox()
    expect(createDraftBox).not.toBeNull()
    expect(composerBox).not.toBeNull()
    expect(
      (createDraftBox?.y ?? 0) + (createDraftBox?.height ?? 0)
    ).toBeLessThanOrEqual(composerBox?.y ?? 0)
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
    await expect(welcome).toContainText(
      'Explain KlickerUZH features using its documentation and tutorials'
    )
    await expect(welcome).toContainText('Read-only for everything else')
    await expect(
      welcome.getByText(/Read-only for everything else/)
    ).toHaveClass(/(^|\s)text-muted-foreground(\s|$)/)
  })

  test('Manage composer accepts at most two images without changing the participant limit', async ({
    page,
  }) => {
    await mockManageChatStream(page)
    const assistant = await openManageAssistantWidget(page)
    const composer = assistant.getByTestId('chat-composer')
    const attachInput = composer.getByTestId('chat-composer-attach-input')

    // Like the controlled textarea in sendManageAssistantMessage(), the
    // embedded assistant runtime can miss the first event while it hydrates.
    // Re-apply the selection until the runtime, not only the DOM input, owns it.
    await expect(async () => {
      await attachInput.setInputFiles(testImageUpload('image-1.png'))
      await expect(
        composer.getByTestId('chat-composer-attachment')
      ).toHaveCount(1, { timeout: 1_000 })
    }).toPass({ timeout: 15_000 })

    await expect(async () => {
      await attachInput.setInputFiles([
        testImageUpload('image-2.png'),
        testImageUpload('image-3.png'),
      ])
      await expect(
        composer.getByTestId('chat-composer-attachment')
      ).toHaveCount(2, { timeout: 1_000 })
      await expect(
        assistant.getByText('You can only attach up to 2 images.')
      ).toBeVisible({ timeout: 1_000 })
    }).toPass({ timeout: 15_000 })

    await expect(
      assistant.getByText('You can only attach up to 2 images.')
    ).toBeVisible()
    await expect(
      composer.getByTestId('chat-composer-attach-button')
    ).toHaveCount(0)
    await expect(composer.getByTestId('chat-composer-attachment')).toHaveCount(
      2
    )
  })

  test('A guarded reset starts a clean in-session conversation without reloading the iframe', async ({
    page,
  }) => {
    await mockManageChatStream(page, {
      text: 'This answer belongs to the current conversation.',
    })
    const assistant = await openManageAssistantWidget(page)
    const reset = assistant.getByTestId('manage-assistant-new-conversation')

    await reset.click()
    await expect(reset).not.toContainText('Start over?')
    await expect(assistant.getByTestId('chat-welcome-message')).toBeVisible()

    await sendManageAssistantMessage(assistant, 'Start this conversation')
    await expect(assistant.getByTestId('chat-assistant-message')).toBeVisible()
    const toolbarBox = await reset.boundingBox()
    const firstMessageBox = await assistant
      .getByTestId('chat-user-message')
      .first()
      .boundingBox()
    expect(toolbarBox).not.toBeNull()
    expect(firstMessageBox).not.toBeNull()
    if (!toolbarBox || !firstMessageBox) {
      throw new Error('Expected toolbar and first message bounding boxes')
    }
    expect(firstMessageBox.y).toBeGreaterThanOrEqual(
      toolbarBox.y + toolbarBox.height
    )
    const input = assistant.getByTestId('chat-composer-input')
    await expect(async () => {
      await input.evaluate((element, value) => {
        const textarea = element as HTMLTextAreaElement
        const setValue = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value'
        )?.set
        setValue?.call(textarea, value)
        textarea.dispatchEvent(new Event('input', { bubbles: true }))
      }, 'Unsent follow-up')
      await expect(assistant.getByTestId('chat-send-button')).toBeEnabled({
        timeout: 1_000,
      })
    }).toPass({ timeout: 15_000 })
    await assistant
      .getByTestId('chat-composer-attach-input')
      .setInputFiles(testImageUpload('reset-me.png'))
    await expect(assistant.getByTestId('chat-composer-attachment')).toHaveCount(
      1
    )
    await assistant.locator('body').evaluate((body) => {
      body.dataset.resetMarker = 'same-document'
    })

    await reset.click()
    await expect(reset).toContainText('Start over?')
    await expect(reset).toHaveAccessibleName(
      'Confirm starting a new conversation'
    )

    await reset.press('Escape')
    await expect(reset).not.toContainText('Start over?')
    await expect(page.getByTestId('manage-assistant-drawer')).toBeVisible()

    await reset.click()
    await expect(reset).toContainText('Start over?')

    await reset.click()

    await expect(assistant.getByTestId('chat-user-message')).toHaveCount(0)
    await expect(assistant.getByTestId('chat-assistant-message')).toHaveCount(0)
    await expect(assistant.getByTestId('chat-welcome-message')).toBeVisible()
    await expect(input).toHaveValue('')
    await expect(assistant.getByTestId('chat-composer-attachment')).toHaveCount(
      0
    )
    expect(
      await assistant
        .locator('body')
        .evaluate((body) => body.dataset.resetMarker)
    ).toBe('same-document')
  })

  test('Reset is disabled while an answer is running', async ({ page }) => {
    await page.context().route('**/api/manage/chat', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      await new Promise((resolve) => setTimeout(resolve, 2_000))
      return route.fulfill({
        body: 'data: {"type":"start"}\n\ndata: {"type":"finish"}\n\ndata: [DONE]\n\n',
        headers: {
          'content-type': 'text/event-stream',
          'x-vercel-ai-ui-message-stream': 'v1',
        },
        status: 200,
      })
    })
    const assistant = await openManageAssistantWidget(page)

    await sendManageAssistantMessage(assistant, 'Keep running briefly')

    await expect(
      assistant.getByTestId('manage-assistant-new-conversation')
    ).toBeDisabled()
  })

  test('Closing and reopening preserves the loaded assistant runtime', async ({
    page,
  }) => {
    await mockManageChatStream(page)
    const assistant = await openManageAssistantWidget(page)
    const input = assistant.getByTestId('chat-composer-input')

    await assistant.getByText('Draft a question', { exact: true }).click()
    const draftPrompt = await input.inputValue()
    expect(draftPrompt).not.toBe('')

    const dialog = page.getByTestId('manage-assistant-drawer')
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toBeHidden()

    await page.getByTestId('manage-assistant-open').click()
    await expect(dialog).toBeVisible()
    await expect(input).toHaveValue(draftPrompt)
  })

  test('Assistant dock keeps the Manage page interactive', async ({ page }) => {
    await mockManageChatStream(page)

    const trigger = page.getByTestId('manage-assistant-open')
    await expect(trigger).toHaveAttribute(
      'aria-controls',
      'manage-assistant-panel'
    )
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await expect(trigger).not.toHaveAttribute('aria-haspopup', 'dialog')
    const triggerBox = await trigger.boundingBox()
    const viewport = page.viewportSize()
    expect(triggerBox).not.toBeNull()
    expect(viewport).not.toBeNull()
    expect(
      Math.abs(
        (triggerBox?.x ?? 0) +
          (triggerBox?.width ?? 0) / 2 -
          (viewport?.width ?? 0) / 2
      )
    ).toBeLessThanOrEqual(1)

    await openManageAssistantWidget(page)

    const panel = page.getByTestId('manage-assistant-drawer')
    await expect(panel).toHaveAttribute('id', 'manage-assistant-panel')
    await expect(panel).not.toHaveAttribute('aria-modal', 'true')
    expect(await panel.evaluate((element) => element.tagName)).toBe('ASIDE')
    expect(
      await panel.evaluate((element) => element.closest('#__app') === null)
    ).toBe(true)

    const appRoot = page.locator('#__app')
    await expect(appRoot).not.toHaveAttribute('aria-hidden', 'true')
    expect(
      await appRoot.evaluate((element) => (element as HTMLElement).inert)
    ).toBe(false)

    const search = page.getByPlaceholder('Search...')
    await search.fill('Keep Manage interactive')
    await expect(search).toHaveValue('Keep Manage interactive')

    await panel.getByRole('button', { name: 'Close' }).click()

    await expect(panel).toBeHidden()
    await expect(panel).toHaveAttribute('aria-hidden', 'true')
    expect(
      await panel.evaluate((element) => (element as HTMLElement).inert)
    ).toBe(true)
    await expect(trigger).toBeFocused()
  })

  test('Keyboard focus enters the dock and Escape closes it from inside the iframe', async ({
    page,
  }) => {
    await mockManageChatStream(page)

    const trigger = page.getByTestId('manage-assistant-open')
    await trigger.focus()
    await trigger.press('Enter')

    const panel = page.getByTestId('manage-assistant-drawer')
    const close = panel.getByRole('button', { name: 'Close' })
    await expect(panel).toBeVisible()
    await expect(close).toBeFocused()

    const assistant = page.frameLocator('[data-cy="manage-assistant-frame"]')
    const input = assistant.getByTestId('chat-composer-input')
    await input.waitFor({ state: 'visible' })
    await input.focus()
    await input.press('Escape')

    await expect(panel).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('Assistant dock resizes with the keyboard and retains its dimensions', async ({
    page,
  }) => {
    await mockManageChatStream(page)
    await page.evaluate(() => {
      window.localStorage.setItem(
        'klicker-manage-assistant-panel-size-v1',
        JSON.stringify({ height: 560, width: 440 })
      )
    })
    await page.reload()
    await openManageAssistantWidget(page)

    const panel = page.getByTestId('manage-assistant-drawer')
    const resize = page.getByTestId('manage-assistant-resize')
    const initial = await panel.boundingBox()
    expect(initial).not.toBeNull()

    await resize.focus()
    await resize.press('ArrowLeft')
    await resize.press('ArrowUp')

    await expect(async () => {
      const keyboardResized = await panel.boundingBox()
      expect(keyboardResized?.width).toBe((initial?.width ?? 0) + 16)
      expect(keyboardResized?.height).toBe((initial?.height ?? 0) + 16)
    }).toPass()

    const keyboardResized = await panel.boundingBox()
    const resizeBox = await resize.boundingBox()
    expect(resizeBox).not.toBeNull()
    await page.mouse.move(
      (resizeBox?.x ?? 0) + (resizeBox?.width ?? 0) / 2,
      (resizeBox?.y ?? 0) + (resizeBox?.height ?? 0) / 2
    )
    await page.mouse.down()
    await page.mouse.move(
      (resizeBox?.x ?? 0) + (resizeBox?.width ?? 0) / 2 - 24,
      (resizeBox?.y ?? 0) + (resizeBox?.height ?? 0) / 2 - 24
    )
    await page.mouse.up()

    await expect(async () => {
      const pointerResized = await panel.boundingBox()
      expect(pointerResized?.width).toBe((keyboardResized?.width ?? 0) + 24)
      expect(pointerResized?.height).toBe((keyboardResized?.height ?? 0) + 24)
    }).toPass()

    const resized = await panel.boundingBox()
    await panel.getByRole('button', { name: 'Close' }).click()
    await page.getByTestId('manage-assistant-open').click()
    await expect(panel).toBeVisible()

    const reopened = await panel.boundingBox()
    expect(reopened?.width).toBe(resized?.width)
    expect(reopened?.height).toBe(resized?.height)
  })

  test('Short desktop viewports keep the default dock controls reachable', async ({
    page,
  }) => {
    await mockManageChatStream(page)
    await page.evaluate(() => {
      window.localStorage.removeItem('klicker-manage-assistant-panel-size-v1')
    })
    await page.setViewportSize({ height: 560, width: 900 })
    await page.reload()

    await openManageAssistantWidget(page)

    const panel = page.getByTestId('manage-assistant-drawer')
    const panelBox = await panel.boundingBox()
    expect(panelBox).not.toBeNull()
    expect(panelBox?.y).toBeGreaterThanOrEqual(0)
    expect(panelBox?.height).toBeLessThanOrEqual(512)
    await expect(panel.getByRole('button', { name: 'Close' })).toBeVisible()
  })

  test('Assistant dock remains usable when browser storage is blocked', async ({
    page,
  }) => {
    await mockManageChatStream(page)
    const blockedStorageErrors: string[] = []
    page.on('pageerror', (error) => {
      if (error.message === 'Storage blocked') {
        blockedStorageErrors.push(error.message)
      }
    })
    await page.addInitScript((storageKey) => {
      const originalGetItem = Storage.prototype.getItem
      const originalSetItem = Storage.prototype.setItem

      Storage.prototype.getItem = function (key) {
        if (key === storageKey) throw new Error('Storage blocked')
        return originalGetItem.call(this, key)
      }
      Storage.prototype.setItem = function (key, value) {
        if (key === storageKey) throw new Error('Storage blocked')
        return originalSetItem.call(this, key, value)
      }
    }, 'klicker-manage-assistant-panel-size-v1')
    await page.reload()

    await openManageAssistantWidget(page)

    const panel = page.getByTestId('manage-assistant-drawer')
    await expect(panel).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Close' })).toBeVisible()
    await expect(page.getByTestId('manage-assistant-resize')).toBeVisible()
    expect(blockedStorageErrors).toEqual([])
  })

  test('Mobile opening keeps the full dock reachable without overwriting desktop dimensions', async ({
    page,
  }) => {
    await mockManageChatStream(page)
    const desktopSize = { height: 700, width: 600 }
    await page.evaluate((size) => {
      window.localStorage.setItem(
        'klicker-manage-assistant-panel-size-v1',
        JSON.stringify(size)
      )
    }, desktopSize)
    await page.setViewportSize({ height: 390, width: 390 })
    await page.reload()

    await openManageAssistantWidget(page)

    const panel = page.getByTestId('manage-assistant-drawer')
    const panelBox = await panel.boundingBox()
    expect(panelBox).not.toBeNull()
    expect(panelBox?.x).toBe(0)
    expect(panelBox?.y).toBeGreaterThanOrEqual(0)
    expect(panelBox?.width).toBe(390)
    expect(panelBox?.height).toBeLessThanOrEqual(390)
    await expect(panel.getByRole('button', { name: 'Close' })).toBeVisible()
    await expect(page.getByTestId('manage-assistant-resize')).toBeHidden()
    expect(
      await page.evaluate(() =>
        JSON.parse(
          window.localStorage.getItem(
            'klicker-manage-assistant-panel-size-v1'
          ) ?? 'null'
        )
      )
    ).toEqual(desktopSize)
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
    // The conversation starters render in their own section next to the
    // welcome message, not inside it, so scope surface assertions here.
    const suggestions = assistant.getByTestId('chat-welcome-suggestions')

    for (const text of [
      'Draft a question',
      'Find questions',
      'Improve feedback',
    ]) {
      await expect(suggestions.getByText(text, { exact: true })).toBeVisible()
    }

    // Course-dashboard-only suggestions must not leak into this surface.
    await expect(
      suggestions.getByText('Summarize this course', { exact: true })
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
    const suggestions = assistant.getByTestId('chat-welcome-suggestions')

    // The course-dashboard set only replaces the default suggestions once the
    // parent → iframe manage-context handshake completes, which races the
    // widget opening — allow extra time for that async update to settle.
    for (const text of [
      'Summarize this course',
      'Draft course question',
      'Find course material',
    ]) {
      await expect(suggestions.getByText(text, { exact: true })).toBeVisible({
        timeout: 15_000,
      })
    }

    // Question-pool-only suggestions must not leak into this surface (retries
    // until the handshake has swapped the default set out).
    await expect(
      suggestions.getByText('Draft a question', { exact: true })
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

    // Stretch the iframe's own script fetches so the Chat listener and its
    // `klicker:manage-context-ready` ping arrive late. The course-dashboard
    // suggestions below only replace the defaults once the Manage context
    // lands, so this proves that the validated ready ping delivers the initial
    // context with no load-time send or timed retry burst.
    await delayChatIframeScripts(page, 1_000)

    await page.getByTestId('manage-assistant-open').click()
    const loading = page.getByTestId('manage-assistant-loading')
    await expect(loading).toBeVisible()
    await expect(loading).toContainText('Loading assistant')

    const assistant = page.frameLocator('[data-cy="manage-assistant-frame"]')
    await assistant
      .getByTestId('chat-composer')
      .waitFor({ state: 'visible', timeout: 20_000 })
    await expect(loading).toBeHidden()
    const suggestions = assistant.getByTestId('chat-welcome-suggestions')

    for (const text of [
      'Summarize this course',
      'Draft course question',
      'Find course material',
    ]) {
      await expect(suggestions.getByText(text, { exact: true })).toBeVisible({
        timeout: 20_000,
      })
    }

    // Question-pool-only suggestions must not leak in: the default set was
    // never the one actually shown, confirming the swap really happened.
    await expect(
      suggestions.getByText('Draft a question', { exact: true })
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
