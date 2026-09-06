import { expect, test } from '@playwright/test'
import de from '../../packages/i18n/messages/de.js'
import en from '../../packages/i18n/messages/en.js'
import {
  CHATBOT_ID,
  chatUrl,
  getEnrolledParticipantId,
  mockChatStream,
  resetChatState,
  seedThread,
  setDisclaimerState,
  setParticipantToken,
  testImageUpload,
} from '../util/chat.js'

test.use({ video: 'off' })

for (const locale of ['en', 'de'] as const) {
  test.describe(`Chat mobile polish (${locale})`, () => {
    test.use({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      locale,
    })

    test.afterEach(async ({ page }, testInfo) => {
      if (!page.isClosed()) {
        await page.screenshot({ path: testInfo.outputPath('final-mobile.png') })
      }
    })

    test('copy failure recovers and inactive thread actions work by touch', async ({
      page,
    }, testInfo) => {
      const messages = locale === 'de' ? de : en
      const participantId = await getEnrolledParticipantId()
      await resetChatState(participantId)
      await setDisclaimerState(participantId, 'accepted')
      await setParticipantToken(page, participantId)
      await page
        .context()
        .addCookies([{ name: 'NEXT_LOCALE', value: locale, url: chatUrl() }])
      await mockChatStream(page, { text: 'Synthetic response.' })
      const code = 'const example = 1'
      const active = await seedThread(participantId, {
        title: 'Synthetic code example',
        messages: [
          { role: 'user', content: [{ type: 'text', text: 'Example' }] },
          {
            role: 'assistant',
            content: [{ type: 'text', text: `\`\`\`js\n${code}\n\`\`\`` }],
          },
        ],
      })
      await seedThread(participantId, {
        title: 'Synthetic inactive conversation',
        messages: [],
      })
      await page.addInitScript(() => {
        let denied = true
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: {
            writeText: async (value: string) => {
              if (denied) {
                denied = false
                throw new DOMException('Denied', 'NotAllowedError')
              }
              document.documentElement.dataset.copiedCode = value
            },
          },
        })
      })
      await page.goto(`${chatUrl()}/${CHATBOT_ID}/threads/${active.id}`)
      const answer = page.getByTestId('chat-assistant-message-content')
      const copy = answer.getByRole('button', {
        name: messages.chat.markdown.copyCode,
        exact: true,
      })
      await expect(copy).toBeVisible()
      const renderedCode = await answer.locator('code').textContent()
      const copyBox = await copy.boundingBox()
      expect(copyBox!.width).toBeGreaterThanOrEqual(44)
      expect(copyBox!.height).toBeGreaterThanOrEqual(44)
      await copy.tap()
      const status = answer.getByRole('status')
      await expect(status).not.toBeEmpty()
      await expect(status).toBeVisible()
      expect(
        await status.evaluate((node) => node.scrollWidth <= node.clientWidth)
      ).toBe(true)
      await page.screenshot({
        path: testInfo.outputPath('copy-denied-mobile.png'),
      })
      await copy.tap()
      await expect(page.locator('html')).toHaveAttribute(
        'data-copied-code',
        renderedCode!
      )
      await expect(status).not.toBeEmpty()

      await page
        .getByRole('button', {
          name: messages.chat.sidebar.openSidebar,
          exact: true,
        })
        .tap()
      const inactive = page
        .getByTestId('chat-thread-item')
        .filter({ hasText: 'Synthetic inactive conversation' })
      const activeRow = page
        .getByTestId('chat-thread-item')
        .filter({ hasText: 'Synthetic code example' })
      await expect(
        inactive.getByTestId('chat-thread-select')
      ).not.toHaveAttribute('aria-current', 'page')
      await expect(activeRow.getByTestId('chat-thread-select')).toHaveAttribute(
        'aria-current',
        'page'
      )
      const rename = inactive.getByTestId('chat-thread-edit-button')
      await expect(rename).toBeVisible()
      const renameBox = await rename.boundingBox()
      expect(renameBox!.width).toBeGreaterThanOrEqual(44)
      expect(renameBox!.height).toBeGreaterThanOrEqual(44)
      await rename.tap()
      await expect(page.getByTestId('chat-thread-title-input')).toBeFocused()
      await page.getByTestId('chat-thread-title-cancel').tap()
      await expect(page).toHaveURL(new RegExp(`/threads/${active.id}$`))
      const remove = inactive.getByTestId('chat-thread-delete-button')
      const removeBox = await remove.boundingBox()
      expect(removeBox!.width).toBeGreaterThanOrEqual(44)
      expect(removeBox!.height).toBeGreaterThanOrEqual(44)
      await remove.tap()
      await expect(remove).toHaveText(/.+/)
      await expect(remove).toHaveAccessibleName(
        messages.chat.threadList.deleteConfirmAria
      )
      await expect(inactive.getByRole('status')).not.toBeEmpty()
      await expect(inactive).toBeVisible()
      await expect(activeRow.getByTestId('chat-thread-select')).toHaveAttribute(
        'aria-current',
        'page'
      )
      await expect(page).toHaveURL(new RegExp(`/threads/${active.id}$`))
      await page.screenshot({
        path: testInfo.outputPath('history-touch-confirm.png'),
      })
      await remove.tap()
      await expect(inactive).toHaveCount(0)
      await expect(page).toHaveURL(new RegExp(`/threads/${active.id}$`))
      await page.setViewportSize({ width: 320, height: 740 })
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      ).toBe(true)
    })

    test('mobile disclaimer decline and reaccept returns to chat', async ({
      page,
    }) => {
      const participantId = await getEnrolledParticipantId()
      await resetChatState(participantId)
      await setDisclaimerState(participantId, 'pending')
      await setParticipantToken(page, participantId)
      await page
        .context()
        .addCookies([{ name: 'NEXT_LOCALE', value: locale, url: chatUrl() }])

      await page.goto(`${chatUrl()}/${CHATBOT_ID}`)
      await page.getByTestId('chat-disclaimer-decline').tap()
      await expect(page.getByTestId('chat-disclaimer-declined')).toBeVisible()

      await page.setViewportSize({ width: 320, height: 740 })
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%'
      })
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      ).toBe(true)
      await expect(
        page
          .getByTestId('chat-disclaimer-declined')
          .getByRole('heading', { level: 1 })
      ).toBeVisible()
      await page.getByTestId('chat-show-disclaimer-again').tap()
      await page.evaluate(() => {
        document.documentElement.style.fontSize = ''
      })
      await expect(page.getByTestId('chat-disclaimer-content')).toBeVisible()
      await page.getByTestId('chat-disclaimer-accept').tap()

      await expect(page.getByTestId('chat-disclaimer-content')).toHaveCount(0)
      await expect(page.getByTestId('chat-composer')).toBeVisible()
    })

    test('mobile message editing focuses the visible edit field', async ({
      page,
    }) => {
      const participantId = await getEnrolledParticipantId()
      await resetChatState(participantId)
      await setDisclaimerState(participantId, 'accepted')
      await setParticipantToken(page, participantId)
      await page
        .context()
        .addCookies([{ name: 'NEXT_LOCALE', value: locale, url: chatUrl() }])
      const thread = await seedThread(participantId, {
        title: 'Mobile edit focus',
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Edit this message' }],
          },
          {
            role: 'assistant',
            content: [{ type: 'text', text: 'A synthetic answer.' }],
          },
        ],
      })

      await page.goto(`${chatUrl()}/${CHATBOT_ID}/threads/${thread.id}`)
      const userMessage = page.getByTestId('chat-user-message').first()
      await expect(userMessage).toBeVisible()
      await userMessage.getByTestId('chat-edit-message-button').tap()

      await expect(page.getByTestId('chat-edit-composer-input')).toBeFocused()
    })

    test('reduced motion citation jump uses an instant source scroll', async ({
      page,
    }) => {
      const participantId = await getEnrolledParticipantId()
      await resetChatState(participantId)
      await setDisclaimerState(participantId, 'accepted')
      await setParticipantToken(page, participantId)
      await page
        .context()
        .addCookies([{ name: 'NEXT_LOCALE', value: locale, url: chatUrl() }])
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.addInitScript(() => {
        const state = window as typeof window & {
          __mobilePolishScrollCalls?: Array<{
            behavior?: ScrollBehavior
            id: string
          }>
        }
        state.__mobilePolishScrollCalls = []
        const originalScrollIntoView = Element.prototype.scrollIntoView
        Element.prototype.scrollIntoView = function (options) {
          state.__mobilePolishScrollCalls?.push({
            behavior:
              typeof options === 'object' ? options.behavior : undefined,
            id: this.id,
          })
          originalScrollIntoView.call(this, options)
        }
      })
      const messageId = '4a1b2c3d-0021-4a91-8f6c-2b7d1e5a9c40'
      const thread = await seedThread(participantId, {
        title: 'Reduced motion citation',
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Show the source' }],
          },
          {
            id: messageId,
            role: 'assistant',
            content: [
              {
                type: 'tool-call' as const,
                toolCallId: 'mobile-citation-call',
                toolName: 'KB_doc_query',
                args: { query: 'synthetic source' },
                result: {
                  content: [
                    {
                      type: 'text' as const,
                      text: JSON.stringify({
                        answer: 'Synthetic source answer.',
                        sources_used: 1,
                        sources: [
                          {
                            file_name: 'Synthetic source.pdf',
                            source_url:
                              'https://example.com/synthetic-source.pdf',
                            source_type: 'document',
                            page_number: 1,
                          },
                        ],
                      }),
                    },
                  ],
                },
              },
              { type: 'text' as const, text: 'See [1].' },
            ],
          },
        ],
      })

      await page.goto(`${chatUrl()}/${CHATBOT_ID}/threads/${thread.id}`)
      const citation = page.getByTestId('chat-citation')
      await expect(citation).toBeVisible()
      await citation.tap()

      await expect
        .poll(async () =>
          page.evaluate((id) => {
            const calls = (
              window as typeof window & {
                __mobilePolishScrollCalls?: Array<{
                  behavior?: ScrollBehavior
                  id: string
                }>
              }
            ).__mobilePolishScrollCalls
            return calls?.filter((call) => call.id === id).at(-1)?.behavior
          }, `src-${messageId}-1`)
        )
        .toBe('auto')
      await expect(page.locator(`#src-${messageId}-1`)).toBeFocused()
    })

    test('touch can stop a streamed answer', async ({ page }) => {
      const participantId = await getEnrolledParticipantId()
      await resetChatState(participantId)
      await setDisclaimerState(participantId, 'accepted')
      await setParticipantToken(page, participantId)
      await page
        .context()
        .addCookies([{ name: 'NEXT_LOCALE', value: locale, url: chatUrl() }])
      await mockChatStream(page, {
        textChunks: ['A partial answer', ' and a chunk that should not land.'],
        chunkDelayMs: 40,
        pauseAfterTextChunk: 1,
      })

      await page.goto(`${chatUrl()}/${CHATBOT_ID}`)
      const input = page.getByTestId('chat-composer-input')
      await input.fill('Stop this response')
      await page.getByTestId('chat-send-button').tap()
      await expect(
        page.getByTestId('chat-assistant-message-content')
      ).toContainText('A partial answer', { timeout: 15_000 })

      await page.getByTestId('chat-cancel-button').tap()
      await expect(page.getByTestId('chat-send-button')).toHaveAttribute(
        'aria-hidden',
        'false'
      )
      await expect(
        page.getByTestId('chat-assistant-message-content')
      ).not.toContainText('and a chunk that should not land.')
    })

    test('touch retry recovers a failed streamed answer', async ({ page }) => {
      const participantId = await getEnrolledParticipantId()
      await resetChatState(participantId)
      await setDisclaimerState(participantId, 'accepted')
      await setParticipantToken(page, participantId)
      await page
        .context()
        .addCookies([{ name: 'NEXT_LOCALE', value: locale, url: chatUrl() }])
      await mockChatStream(page, {
        text: 'Partial answer before retry.',
        omitFinish: true,
      })

      await page.goto(`${chatUrl()}/${CHATBOT_ID}`)
      const input = page.getByTestId('chat-composer-input')
      await input.fill('Retry this response')
      await page.getByTestId('chat-send-button').tap()

      const error = page.getByTestId('chat-message-error')
      await expect(error).toBeVisible({ timeout: 15_000 })
      const retry = error.getByTestId('chat-retry-message-button')
      await expect(retry).toBeVisible()

      await page.unroute(`**/api/chatbots/${CHATBOT_ID}/chat`)
      await mockChatStream(page, { text: 'Recovered answer.' })
      await retry.tap()

      await expect(
        page.getByTestId('chat-assistant-message-content')
      ).toContainText('Recovered answer.', { timeout: 15_000 })
      await expect(page.getByTestId('chat-message-error')).toHaveCount(0)
    })

    test('mobile attachment preview stays usable and removable', async ({
      page,
    }) => {
      const participantId = await getEnrolledParticipantId()
      await resetChatState(participantId)
      await setDisclaimerState(participantId, 'accepted')
      await setParticipantToken(page, participantId)
      await page
        .context()
        .addCookies([{ name: 'NEXT_LOCALE', value: locale, url: chatUrl() }])
      await page.goto(`${chatUrl()}/${CHATBOT_ID}`)

      await page
        .getByTestId('chat-composer-attach-input')
        .setInputFiles(testImageUpload())
      const attachment = page.getByTestId('chat-composer-attachment')
      await expect(attachment).toBeVisible()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      ).toBe(true)
      await attachment.getByTestId('chat-attachment-remove').tap()
      await expect(attachment).toHaveCount(0)
    })
  })
}

test.describe('Chat desktop settings DOM inspection', () => {
  test.use({
    viewport: { width: 1440, height: 900 },
    isMobile: false,
    hasTouch: false,
    locale: 'en',
  })

  test('settings controls keep their label association with the menu open', async ({
    page,
  }, testInfo) => {
    const participantId = await getEnrolledParticipantId()
    await resetChatState(participantId)
    await setDisclaimerState(participantId, 'accepted')
    await setParticipantToken(page, participantId)
    await page
      .context()
      .addCookies([{ name: 'NEXT_LOCALE', value: 'en', url: chatUrl() }])

    await page.goto(`${chatUrl()}/${CHATBOT_ID}`)
    await page.getByTestId('chat-settings-toggle').click()
    await expect(page.getByTestId('chat-settings-panel')).toBeVisible()
    const modelSelect = page.locator('[data-cy="chat-model-select"]')
    await expect(modelSelect).toBeVisible()
    await expect(modelSelect).toHaveAccessibleName(/\S/)
    await modelSelect.click()
    await expect(page.getByRole('option').first()).toBeVisible()

    const duplicateIds = await page.evaluate(() => {
      const counts = new Map<string, number>()
      for (const element of document.querySelectorAll('[id]')) {
        counts.set(element.id, (counts.get(element.id) ?? 0) + 1)
      }
      return [...counts.entries()]
        .filter(([, count]) => count > 1)
        .map(([id, count]) => ({ count, id }))
        .sort((left, right) => left.id.localeCompare(right.id))
    })
    expect(duplicateIds).toEqual([])
    expect(
      await modelSelect.evaluate((element) => {
        const control = element as HTMLButtonElement
        return (
          control.labels?.length === 1 && control.labels[0].control === control
        )
      })
    ).toBe(true)
    await page.keyboard.press('Escape')
    await expect(modelSelect).toBeFocused()
    await expect(modelSelect).toHaveAccessibleName(/\S/)
    await page.screenshot({ path: testInfo.outputPath('settings-desktop.png') })
    await expect(page.getByTestId('chat-settings-panel')).toBeVisible()
  })
})
