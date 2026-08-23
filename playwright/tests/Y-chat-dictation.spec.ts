import { expect, test, type Page } from '@playwright/test'
import {
  CHATBOT_ID,
  chatUrl,
  clearChatCookies,
  getEnrolledParticipantId,
  resetChatState,
  setDisclaimerState,
  setParticipantToken,
  seedThread,
} from '../util/chat.js'
import { isRendererCrash } from '../util/resources.js'

/**
 * Chatbot Dictation E2E (split from Y-chat.spec.ts)
 *
 * Lives in its own spec file so the shard balancer can spread the chat
 * suite across two CI shards; the per-worker browser load had grown past
 * what a single shard could carry reliably.
 */

async function installDictationFake(
  page: Page,
  options: {
    availability: 'available' | 'downloadable' | 'downloading' | 'unavailable'
    installResult?: boolean
    mobile?: boolean
  }
) {
  await page.addInitScript(({ availability, installResult, mobile }) => {
    Object.defineProperty(navigator, 'userAgentData', {
      configurable: true,
      value: { mobile: mobile ?? false },
    })

    const fakeState = {
      availability,
      availableCalls: [] as unknown[],
      installCalls: [] as unknown[],
      instances: [] as unknown[],
      installResult: installResult ?? true,
      startCalls: 0,
      synthesisCancelCalls: 0,
    }

    class FakeRecognition {
      continuous = false
      interimResults = false
      lang = ''
      maxAlternatives = 0
      processLocally = false
      onend: (() => void) | null = null
      onerror: ((event: { error: string }) => void) | null = null
      onresult:
        | ((event: {
            resultIndex: number
            results: Array<{
              isFinal: boolean
              length: number
              0: { transcript: string }
            }>
          }) => void)
        | null = null
      onstart: (() => void) | null = null

      constructor() {
        fakeState.instances.push(this)
      }

      start() {
        fakeState.startCalls += 1
        this.onstart?.()
      }

      stop() {
        this.onend?.()
      }

      abort() {
        this.onend?.()
      }

      emitResult(text: string, isFinal: boolean) {
        this.onresult?.({
          resultIndex: 0,
          results: [
            {
              0: { transcript: text },
              isFinal,
              length: 1,
            },
          ],
        })
      }

      emitError(error: string) {
        this.onerror?.({ error })
      }
    }

    ;(
      FakeRecognition as typeof FakeRecognition & {
        available: (options: unknown) => Promise<string>
        install: (options: unknown) => Promise<boolean>
      }
    ).available = async (options) => {
      fakeState.availableCalls.push(options)
      return fakeState.availability
    }
    ;(
      FakeRecognition as typeof FakeRecognition & {
        available: (options: unknown) => Promise<string>
        install: (options: unknown) => Promise<boolean>
      }
    ).install = async (options) => {
      fakeState.installCalls.push(options)
      if (fakeState.installResult) fakeState.availability = 'available'
      return fakeState.installResult
    }

    const speechWindow = window as typeof window & {
      __dictationFake: typeof fakeState
      __emitDictationResult: (text: string, isFinal: boolean) => void
      __emitDictationFinalAndEnd: (text: string) => void
      __emitDictationError: (error: string) => void
    }
    Object.defineProperty(speechWindow, 'SpeechRecognition', {
      configurable: true,
      value: FakeRecognition,
      writable: true,
    })
    Object.defineProperty(speechWindow, 'webkitSpeechRecognition', {
      configurable: true,
      value: undefined,
      writable: true,
    })
    speechWindow.__dictationFake = fakeState
    speechWindow.__emitDictationResult = (text, isFinal) => {
      const instance = fakeState.instances.at(-1) as FakeRecognition | undefined
      instance?.emitResult(text, isFinal)
    }
    speechWindow.__emitDictationFinalAndEnd = (text) => {
      const instance = fakeState.instances.at(-1) as FakeRecognition | undefined
      instance?.emitResult(text, true)
      instance?.stop()
    }
    speechWindow.__emitDictationError = (error) => {
      const instance = fakeState.instances.at(-1) as FakeRecognition | undefined
      instance?.emitError(error)
    }

    if (window.speechSynthesis) {
      const cancel = window.speechSynthesis.cancel.bind(window.speechSynthesis)
      window.speechSynthesis.cancel = () => {
        fakeState.synthesisCancelCalls += 1
        cancel()
      }
    }
  }, options)
}

async function removeDictationConstructor(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: undefined,
      writable: true,
    })
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      configurable: true,
      value: undefined,
      writable: true,
    })
  })
}

async function visitChat(page: Page) {
  await page.goto(`${chatUrl()}/${CHATBOT_ID}`, {
    waitUntil: 'domcontentloaded',
  })
  // A hydration stall under CI load is transient: one recovery navigation
  // re-runs the app and usually clears it. A renderer crash is not: retrying
  // navigation on a dead renderer masks the original failure and turns one
  // crash into a cascade of misleading assertion failures, so crash-class
  // errors are surfaced immediately instead of retried here.
  const skeleton = page.getByTestId('chat-loading')
  try {
    await expect(skeleton).toHaveCount(0)
  } catch (error) {
    if (isRendererCrash(error)) {
      throw error
    }
    await page.goto(`${chatUrl()}/${CHATBOT_ID}`, {
      waitUntil: 'domcontentloaded',
    })
    await expect(skeleton).toHaveCount(0)
  }
}

// ===========================================================================
// Dictation
// ===========================================================================
test.describe('Chatbot Dictation', () => {
  let participantId: string

  test.beforeEach(async ({ page }) => {
    participantId = await getEnrolledParticipantId()
    await clearChatCookies(page)
    await setParticipantToken(page, participantId)
    await resetChatState(participantId)
    await setDisclaimerState(participantId, 'accepted')
  })

  test('hides dictation when the constructor is absent', async ({ page }) => {
    await removeDictationConstructor(page)
    await visitChat(page)

    await expect(page.getByTestId('chat-dictation')).toHaveCount(0)
    await page.getByTestId('chat-settings-toggle').click()
    await expect(page.getByTestId('chat-dictation-status')).toContainText(
      'Not supported in this browser'
    )
  })

  test('keeps mobile dictation hidden', async ({ page }) => {
    await installDictationFake(page, {
      availability: 'available',
      mobile: true,
    })
    await visitChat(page)

    await expect(page.getByTestId('chat-dictation')).toHaveCount(0)
  })

  test('keeps embedded dictation hidden on desktop', async ({ page }) => {
    await installDictationFake(page, { availability: 'available' })
    await page.goto(`${chatUrl()}/${CHATBOT_ID}?embed=true`, {
      waitUntil: 'domcontentloaded',
    })
    await expect(page.getByTestId('chat-dictation')).toHaveCount(0)
  })

  test('shows unavailable desktop dictation as disabled', async ({ page }) => {
    await installDictationFake(page, { availability: 'unavailable' })
    await visitChat(page)

    const button = page.getByTestId('chat-dictation')
    await expect(button).toBeVisible()
    await expect(button).toBeDisabled()
    await expect(button).toHaveAttribute('aria-disabled', 'true')

    await page.getByTestId('chat-settings-toggle').click()
    await expect(page.getByTestId('chat-dictation-status')).toContainText(
      'On-device dictation unavailable'
    )
  })

  test('shows a browser-managed language-pack download as indeterminate', async ({
    page,
  }) => {
    await installDictationFake(page, { availability: 'downloading' })
    await visitChat(page)

    const button = page.getByTestId('chat-dictation')
    await expect(button).toBeVisible()
    await expect(button).toBeDisabled()

    await page.getByTestId('chat-settings-toggle').click()
    await expect(page.getByTestId('chat-dictation-status')).toContainText(
      'Downloading the language pack'
    )
  })

  test('installs explicitly, preserves the draft, and maps recognition errors', async ({
    page,
  }) => {
    await installDictationFake(page, { availability: 'downloadable' })
    await visitChat(page)

    const button = page.getByTestId('chat-dictation')
    await page.getByTestId('chat-settings-toggle').click()
    await page.getByTestId('chat-dictation-status-install').click()
    await expect(page.getByTestId('chat-dictation-sheet')).toBeVisible()
    await page.getByTestId('chat-dictation-download').click()
    // A successful install closes the sheet so the composer is usable again.
    await expect(page.getByTestId('chat-dictation-sheet')).toHaveCount(0)

    const fakeState = await page.evaluate(() => {
      const state = (
        window as typeof window & {
          __dictationFake: {
            availableCalls: unknown[]
            installCalls: unknown[]
            startCalls: number
          }
        }
      ).__dictationFake
      return {
        availableCalls: state.availableCalls,
        installCalls: state.installCalls,
        startCalls: state.startCalls,
      }
    })
    expect(fakeState.availableCalls[0]).toEqual({
      langs: ['en-US'],
      processLocally: true,
      quality: 'dictation',
    })
    expect(fakeState.installCalls[0]).toEqual({
      langs: ['en-US'],
      quality: 'dictation',
    })
    expect(fakeState.startCalls).toBe(0)

    const input = page.getByTestId('chat-composer-input')
    await input.fill('Existing draft')
    // The sheet auto-closed after a successful install, so dictation starts
    // from the persistent composer control, not from the unmounted sheet.
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(button).toHaveAccessibleName('Listening...')

    await page.evaluate(() => {
      const state = window as typeof window & {
        __emitDictationResult: (text: string, isFinal: boolean) => void
      }
      state.__emitDictationResult('interim phrase', false)
    })
    await expect(input).toHaveValue('Existing draft interim phrase')

    await page.evaluate(() => {
      const state = window as typeof window & {
        __emitDictationResult: (text: string, isFinal: boolean) => void
      }
      state.__emitDictationResult('final phrase', true)
    })
    await expect(input).toHaveValue('Existing draft final phrase')
    await expect(page.getByTestId('chat-send-button')).toBeEnabled()

    const synthesisCancelCalls = await page.evaluate(
      () =>
        (
          window as typeof window & {
            __dictationFake: { synthesisCancelCalls: number }
          }
        ).__dictationFake.synthesisCancelCalls
    )
    expect(synthesisCancelCalls).toBe(1)

    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await expect(input).toHaveValue('Existing draft final phrase')

    await input.fill('Existing draft')
    await button.click()

    await page.evaluate(() => {
      const state = window as typeof window & {
        __emitDictationError: (error: string) => void
      }
      state.__emitDictationError('not-allowed')
    })
    await expect(
      page.getByText(
        'Microphone access was denied. Allow it in your browser settings.'
      )
    ).toBeVisible()
    await expect(input).toHaveValue('Existing draft')
  })

  test('keeps an immediate final result when recognition ends in the same task', async ({
    page,
  }) => {
    await installDictationFake(page, { availability: 'available' })
    await visitChat(page)

    const input = page.getByTestId('chat-composer-input')
    await input.fill('Existing draft')
    await page.getByTestId('chat-dictation').click()
    await page.evaluate(() => {
      const state = window as typeof window & {
        __emitDictationFinalAndEnd: (text: string) => void
      }
      state.__emitDictationFinalAndEnd('immediate final')
    })

    await expect(input).toHaveValue('Existing draft immediate final')
    await expect(page.getByTestId('chat-dictation')).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  test('restores the captured draft for a no-speech error', async ({
    page,
  }) => {
    await installDictationFake(page, { availability: 'available' })
    await visitChat(page)

    const input = page.getByTestId('chat-composer-input')
    await input.fill('Existing draft')
    await page.getByTestId('chat-dictation').click()
    await page.evaluate(() => {
      const state = window as typeof window & {
        __emitDictationError: (error: string) => void
      }
      state.__emitDictationError('no-speech')
    })

    await expect(
      page.getByText('No speech was detected. Try again.')
    ).toBeVisible()
    await expect(input).toHaveValue('Existing draft')
  })

  test('aborts an active session when switching threads', async ({ page }) => {
    const targetThread = await seedThread(participantId, {
      title: 'Dictation target thread',
    })
    await installDictationFake(page, { availability: 'available' })
    await visitChat(page)

    const input = page.getByTestId('chat-composer-input')
    await input.fill('Thread one draft')
    await page.getByTestId('chat-dictation').click()

    await page
      .getByTestId('chat-thread-item')
      .filter({ hasText: 'Dictation target thread' })
      .getByTestId('chat-thread-select')
      .click()
    await expect(page).toHaveURL(new RegExp(`/threads/${targetThread.id}$`))
    await expect(input).toHaveValue('')
    await expect(page.getByTestId('chat-dictation')).toBeVisible()

    await page.evaluate(() => {
      const state = window as typeof window & {
        __emitDictationFinalAndEnd: (text: string) => void
      }
      state.__emitDictationFinalAndEnd('stale transcript')
    })
    await expect(input).toHaveValue('')
  })

  test('keeps a failed language-pack install explicit', async ({ page }) => {
    await installDictationFake(page, {
      availability: 'downloadable',
      installResult: false,
    })
    await visitChat(page)

    await page.getByTestId('chat-dictation').click()
    await expect(page.getByTestId('chat-dictation-sheet')).toBeVisible()
    await page.getByTestId('chat-dictation-download').click()

    await expect(page.getByTestId('chat-dictation-install-error')).toBeVisible()
    await expect(page.getByTestId('chat-dictation-start')).toHaveCount(0)
    await expect(page.getByTestId('chat-dictation-download')).toHaveText(
      'Try download again'
    )
    const startCalls = await page.evaluate(
      () =>
        (
          window as typeof window & {
            __dictationFake: { startCalls: number }
          }
        ).__dictationFake.startCalls
    )
    expect(startCalls).toBe(0)
  })

  test('maps a local-service rejection to the composer banner', async ({
    page,
  }) => {
    await installDictationFake(page, { availability: 'available' })
    await visitChat(page)

    const input = page.getByTestId('chat-composer-input')
    await input.fill('Existing draft')
    await page.getByTestId('chat-dictation').click()
    await page.evaluate(() => {
      const state = window as typeof window & {
        __emitDictationError: (error: string) => void
      }
      state.__emitDictationError('service-not-allowed')
    })

    await expect(
      page.getByText('The browser did not allow the dictation service.')
    ).toBeVisible()
    await expect(input).toHaveValue('Existing draft')
  })

  test('renders the dictation status and language hint in German', async ({
    page,
  }) => {
    const url = new URL(chatUrl())
    await page.context().addCookies([
      {
        name: 'NEXT_LOCALE',
        value: 'de',
        url: url.origin,
      },
    ])
    await installDictationFake(page, { availability: 'unavailable' })
    await visitChat(page)

    await page.getByTestId('chat-settings-toggle').click()
    const status = page.getByTestId('chat-dictation-status')
    await expect(status).toContainText('Spracheingabe')
    await expect(status).toContainText('Lokales Diktieren ist nicht verfügbar')
    await expect(status).toContainText('Standarddeutsch')
  })
})
