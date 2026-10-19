import { expect, test, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import {
  CHATBOT_ID,
  chatUrl,
  clearChatCookies,
  getEnrolledParticipantId,
  mockChatStream,
  resetChatState,
  seedThread,
  setCodeExecutionPolicy,
  setDisclaimerState,
  setParticipantToken,
} from '../util/chat.js'
import { setSessionCookieForUrl } from '../util/authSession.js'
import { LECTURER_EMAIL, URL_MANAGE, USER_ID_TEST } from '../util/constants.js'
import { enMessages } from '../util/messages.js'

/**
 * Browser code playground (apps/chat)
 *
 * The card is opened by a mocked `open_code_card` tool result or a seeded
 * thread; the code itself runs for real in the sandboxed Pyodide or webR
 * runner. Server-side gating is covered by unit tests, because the mocked
 * chat stream bypasses the chat route. The test runtime turns the deployment
 * kill switch on, and each test admits profiles through the chatbot policy.
 */

const copy = enMessages.shared.codeRunner
const cardCopy = enMessages.chat.codeCard
const BOTH_PROFILES = { modes: { tutor: ['python-core', 'r-base'] } }

type Profile = 'python-core' | 'r-base'

function cardOutput(profile: Profile, starterCode: string) {
  return { kind: 'code-card', profile, starterCode }
}

async function openCardFromAssistant(
  page: Page,
  profile: Profile,
  starterCode: string
) {
  await mockChatStream(page, {
    text: 'Here is a playground to try it.',
    toolCalls: [
      {
        toolCallId: 'code-card-1',
        toolName: 'open_code_card',
        input: { profile, starterCode },
        output: cardOutput(profile, starterCode),
      },
    ],
  })
  await page.goto(`${chatUrl()}/${CHATBOT_ID}`, {
    waitUntil: 'domcontentloaded',
  })
  const input = page.getByTestId('chat-composer-input')
  await input.click()
  await input.pressSequentially('Can I try this myself?')
  await page.getByTestId('chat-send-button').click()
  const card = page.getByTestId('code-card')
  await expect(card).toBeVisible()
  return card
}

async function seedCardThread(
  participantId: string,
  profile: Profile,
  starterCode: string
) {
  return seedThread(participantId, {
    title: 'Code card thread',
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: 'Can I try this myself?' }],
        chatMode: 'tutor',
      },
      {
        role: 'assistant',
        chatMode: 'tutor',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'code-card-seeded',
            toolName: 'open_code_card',
            args: { profile, starterCode },
            result: cardOutput(profile, starterCode),
          },
          { type: 'text', text: 'Here is a playground to try it.' },
        ],
      },
    ],
  })
}

async function runAndWait(page: Page, timeout = 90_000) {
  const card = page.getByTestId('code-card')
  await card.getByRole('button', { name: copy.run }).click()
  await expect(card.getByRole('button', { name: copy.run })).toBeEnabled({
    timeout,
  })
}

test.describe('Chat code card', () => {
  let participantId: string

  test.beforeEach(async ({ page }) => {
    participantId = await getEnrolledParticipantId()
    await clearChatCookies(page)
    await setParticipantToken(page, participantId)
    await resetChatState(participantId)
    await setDisclaimerState(participantId, 'accepted')
    await setCodeExecutionPolicy(BOTH_PROFILES)
  })

  test.afterAll(async () => {
    await setCodeExecutionPolicy(null)
  })

  test('shows a populated card among adjacent tools before the answer finishes', async ({
    page,
  }, testInfo) => {
    const starterCode = 'print(6 * 7)'
    await mockChatStream(page, {
      chunkDelayMs: 50,
      pauseAfterTextChunk: 1,
      textChunks: ['Try the code.', 'Then inspect the result.'],
      toolCalls: [
        {
          toolCallId: 'calculate-before',
          toolName: 'calculate',
          input: { expression: '6 * 7' },
          output: { result: 42 },
        },
        {
          toolCallId: 'streamed-code',
          toolName: 'open_code_card',
          input: { profile: 'python-core', starterCode },
          output: cardOutput('python-core', starterCode),
        },
      ],
    })
    await page.goto(`${chatUrl()}/${CHATBOT_ID}`)
    await page.getByTestId('chat-composer-input').fill('Open a playground')
    await page.getByTestId('chat-send-button').click()
    const card = page.getByTestId('code-card')
    await expect(card).toBeVisible()
    await expect(card.getByRole('textbox')).toHaveValue(starterCode)
    await expect(page.getByTestId('chat-cancel-button')).toHaveAttribute(
      'aria-hidden',
      'false'
    )
    await page.screenshot({
      path: testInfo.outputPath('streamed-code-card.png'),
    })
    await card.getByRole('textbox').fill('print(43)')
    await page.evaluate(() =>
      (
        window as typeof window & { __releaseMockChatStream?: () => void }
      ).__releaseMockChatStream?.()
    )
    await expect(page.getByTestId('chat-cancel-button')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
    await expect(card.getByRole('textbox')).toHaveValue('print(43)')
  })

  test.describe('qualified engines', () => {
    test.skip(
      ({ browserName }) => browserName === 'firefox',
      'Firefox shows the unavailable notice instead'
    )

    test('runs edited Python and resets to the starter code', async ({
      page,
    }) => {
      const card = await openCardFromAssistant(
        page,
        'python-core',
        'print("starter")'
      )
      const editor = card.getByRole('textbox')
      await expect(editor).toHaveValue('print("starter")')

      await editor.fill('print(6 * 7)')
      await runAndWait(page)
      await expect(card.getByTestId('code-runner-status')).toHaveText(
        copy.status.ok
      )
      await expect(card.getByTestId('code-runner-output')).toContainText('42')

      await card.getByRole('button', { name: copy.reset }).click()
      await expect(editor).toHaveValue('print("starter")')
      await expect(card.getByTestId('code-runner-output')).toHaveCount(0)
    })

    test('keeps edits and a running program when the card moves beside the chat', async ({
      page,
    }) => {
      const card = await openCardFromAssistant(page, 'python-core', 'print(1)')
      await card
        .getByRole('textbox')
        .fill(
          'total = 0\nfor i in range(20_000_000):\n    total += i\nprint("sum", total)'
        )
      await card.getByRole('button', { name: copy.run }).click()
      await expect(card.getByTestId('code-runner-status')).toHaveText(
        copy.running,
        { timeout: 90_000 }
      )

      await card.getByRole('button', { name: cardCopy.openInWorkspace }).click()
      const workspace = page.getByTestId('chat-workspace-panel')
      await expect(workspace.getByTestId('code-card')).toBeVisible()
      await expect(page.getByTestId('code-card-opened')).toBeVisible()
      await expect(page.getByTestId('code-card')).toHaveCount(1)
      await expect(
        workspace.getByRole('button', { name: copy.run })
      ).toBeEnabled({ timeout: 90_000 })
      await expect(workspace.getByTestId('code-runner-output')).toContainText(
        'sum 199999990000000'
      )

      await workspace.getByRole('textbox').fill('print("edited beside chat")')
      const close = page
        .getByTestId('workspace-close')
        .or(page.getByTestId('workspace-back-to-chat'))
      await close.click()
      await expect(workspace).toHaveCount(0)
      await expect(page.getByTestId('code-card-opened')).toHaveCount(0)
      const inline = page.getByTestId('code-card')
      await expect(inline.getByRole('textbox')).toHaveValue(
        'print("edited beside chat")'
      )
      await expect(inline.getByTestId('code-runner-output')).toContainText(
        'sum 199999990000000'
      )
      await expect(
        inline.getByRole('button', { name: cardCopy.openInWorkspace })
      ).toBeFocused()
    })

    test('runs R and reports R errors truthfully', async ({ page }) => {
      const card = await openCardFromAssistant(
        page,
        'r-base',
        'cat(mean(c(1, 2, 3)))'
      )
      await runAndWait(page)
      await expect(card.getByTestId('code-runner-status')).toHaveText(
        copy.status.ok
      )
      await expect(card.getByTestId('code-runner-output')).toContainText('2')

      await card
        .getByRole('textbox')
        .fill('cat("before failure\\n")\nstop("synthetic failure")')
      await runAndWait(page)
      await expect(card.getByTestId('code-runner-status')).toHaveText(
        copy.status.error
      )
      const output = card.getByTestId('code-runner-output')
      await expect(output).toContainText('before failure')
      await expect(output).toContainText('synthetic failure')
    })

    test('stops a running program and runs the next one in a fresh runner', async ({
      page,
    }) => {
      const card = await openCardFromAssistant(
        page,
        'python-core',
        'counter = 5\nwhile True:\n    pass'
      )
      const runners = page.locator('iframe[title="Code runner"]')
      await card.getByRole('button', { name: copy.run }).click()
      await expect(card.getByTestId('code-runner-status')).toHaveText(
        copy.running,
        { timeout: 90_000 }
      )
      await card.getByRole('button', { name: copy.stop }).click()
      await expect(card.getByTestId('code-runner-status')).toHaveText(
        copy.status.stopped
      )
      await expect(runners).toHaveCount(0)

      await card
        .getByRole('textbox')
        .fill('print("state:", globals().get("counter"))')
      await runAndWait(page)
      await expect(card.getByTestId('code-runner-output')).toContainText(
        'state: None'
      )
      await expect(runners).toHaveCount(0)
    })

    test('ends a program at the run time limit', async ({ page }) => {
      test.slow()
      const card = await openCardFromAssistant(
        page,
        'python-core',
        'while True:\n    pass'
      )
      await runAndWait(page, 120_000)
      await expect(card.getByTestId('code-runner-status')).toHaveText(
        copy.status.timeout
      )
    })

    test('bounds flooding output', async ({ page }) => {
      // Control characters and quotes grow several times when the result is
      // serialized, so this also covers results that exceed the message cap.
      const card = await openCardFromAssistant(
        page,
        'python-core',
        'import sys\nfor i in range(200000):\n    print("line", i, "\\x01\\"")\n    print("\\x02", file=sys.stderr)'
      )
      await runAndWait(page)
      await expect(card.getByTestId('code-runner-status')).toHaveText(
        copy.status.ok
      )
      await expect(card.getByText(copy.truncated)).toBeVisible()
      const output = await card.locator('pre').first().textContent()
      expect(output?.length ?? 0).toBeLessThanOrEqual(64 * 1024)
    })

    test('blocks program network access', async ({ page, browserName }) => {
      const token = randomUUID()
      const sinkHits: string[] = []
      const sink: Server = createServer((request, response) => {
        sinkHits.push(request.url ?? '')
        response.end('sink')
      })
      await new Promise<void>((resolve) => sink.listen(0, '127.0.0.1', resolve))
      const sinkOrigin = `http://127.0.0.1:${(sink.address() as AddressInfo).port}`
      // Playwright also reports requests that the runner CSP blocks before
      // they reach the network, so only a received response counts as egress.
      const pageResponses: string[] = []
      page.on('response', (response) => {
        if (response.url().includes(token)) pageResponses.push(response.url())
      })

      try {
        const chatOrigin = new URL(chatUrl()).origin
        const probe = [
          'import asyncio, js',
          `targets = ["${sinkOrigin}/${token}", "${chatOrigin}/api/${token}"]`,
          'for url in targets:',
          '    for attempt in (',
          '        lambda: js.fetch(url),',
          '        lambda: js.WebSocket.new(url.replace("http", "ws", 1)),',
          '        lambda: js.EventSource.new(url),',
          '        lambda: js.WebTransport.new(url.replace("http:", "https:", 1)),',
          '    ):',
          '        try:',
          '            attempt()',
          '        except Exception:',
          '            pass',
          '    try:',
          '        xhr = js.XMLHttpRequest.new()',
          '        xhr.open("GET", url, False)',
          '        xhr.send()',
          '    except Exception:',
          '        pass',
          'await asyncio.sleep(2)',
          'print("probe finished")',
        ].join('\n')
        const card = await openCardFromAssistant(page, 'python-core', probe)
        await runAndWait(page)
        await expect(card.getByTestId('code-runner-output')).toContainText(
          'probe finished'
        )
        // Chromium reports blocked worker requests as policy violations.
        if (browserName === 'chromium') {
          await expect(card.getByText(copy.blockedAccess)).toBeVisible()
        }
        expect(sinkHits).toEqual([])
        expect(pageResponses).toEqual([])
      } finally {
        await new Promise((resolve) => sink.close(resolve))
      }
    })

    test('runs inside an embedded Chat frame', async ({
      page,
      browserName,
    }) => {
      const thread = await seedCardThread(
        participantId,
        'python-core',
        'print("from the frame")'
      )
      // On Chromium the embedding page lives on another origin, as an LMS page
      // would, so a frame-ancestors check on the runner would see a foreign
      // ancestor. WebKit withholds the participant cookie from that frame, so
      // it embeds from the Chat origin.
      const crossOrigin = browserName === 'chromium'
      const embedOrigin = crossOrigin
        ? (process.env.URL_MANAGE ?? URL_MANAGE)
        : new URL(chatUrl()).origin
      const embedUrl = `${embedOrigin}/__code-card-embed-test`
      await page.route(embedUrl, (route) =>
        route.fulfill({
          contentType: 'text/html',
          body: `<!doctype html><title>LMS page</title><iframe title="Chat" style="width:1000px;height:900px" src="${chatUrl()}/${CHATBOT_ID}/threads/${thread.id}"></iframe>`,
        })
      )
      if (crossOrigin) {
        // The routed page has no address, so Chromium treats it as public and
        // would block the local Chat frame under Local Network Access.
        await page.context().grantPermissions(['local-network-access'], {
          origin: embedOrigin,
        })
      }
      await page.goto(embedUrl)
      const frame = page.frameLocator('iframe[title="Chat"]')
      const card = frame.getByTestId('code-card')
      await expect(card).toBeVisible()
      await card.getByRole('button', { name: copy.run }).click()
      await expect(card.getByTestId('code-runner-output')).toContainText(
        'from the frame',
        { timeout: 90_000 }
      )
    })

    test('runs an admitted card in owner preview', async ({ page }) => {
      await setSessionCookieForUrl({
        context: page.context(),
        targetUrl: chatUrl(),
        tokenData: {
          email: LECTURER_EMAIL,
          sub: USER_ID_TEST,
          role: 'ADMIN',
          scope: 'ACCOUNT_OWNER',
        },
      })
      // Owner preview uses the stock AI SDK transport, which needs blank-line
      // separated events, text part ids and the stream marker header.
      const output = cardOutput('python-core', 'print(6 * 7)')
      const events = [
        { type: 'start' },
        { type: 'start-step' },
        {
          type: 'tool-input-available',
          toolCallId: 'code-card-preview',
          toolName: 'open_code_card',
          input: { profile: output.profile, starterCode: output.starterCode },
        },
        {
          type: 'tool-output-available',
          toolCallId: 'code-card-preview',
          output,
        },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Try it here.' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish-step' },
        { type: 'finish' },
      ]
      await page.route(
        `**/api/manage/chatbots/${CHATBOT_ID}/preview/chat`,
        (route) =>
          route.fulfill({
            status: 200,
            headers: {
              'content-type': 'text/event-stream',
              'x-vercel-ai-ui-message-stream': 'v1',
            },
            body: `${[...events.map((event) => `data: ${JSON.stringify(event)}`), 'data: [DONE]'].join('\n\n')}\n\n`,
          })
      )
      await page.goto(`${chatUrl()}/preview/${CHATBOT_ID}`)
      const input = page.getByTestId('chat-composer-input')
      await input.click()
      await input.pressSequentially('Can I try this myself?')
      await page.getByTestId('chat-send-button').click()
      const card = page.getByTestId('code-card')
      await expect(card.getByRole('button', { name: copy.run })).toBeEnabled()
      await runAndWait(page)
      await expect(card.getByTestId('code-runner-output')).toContainText('42')
    })

    test('restores edits after a reload with the workspace closed', async ({
      page,
    }) => {
      const thread = await seedCardThread(
        participantId,
        'python-core',
        'print("starter")'
      )
      await page.goto(`${chatUrl()}/${CHATBOT_ID}/threads/${thread.id}`)
      await page
        .getByTestId('code-card')
        .getByRole('textbox')
        .fill('print("edited")')
      await page.reload()
      const card = page.getByTestId('code-card')
      await expect(card.getByRole('textbox')).toHaveValue('print("edited")')
      await expect(page.getByTestId('chat-workspace-panel')).toHaveCount(0)
      await expect(card.getByTestId('code-runner-output')).toHaveCount(0)
    })

    test('a new independent page starts from the starter code', async ({
      page,
    }) => {
      const thread = await seedCardThread(
        participantId,
        'python-core',
        'print("starter")'
      )
      const url = `${chatUrl()}/${CHATBOT_ID}/threads/${thread.id}`
      await page.goto(url)
      await page
        .getByTestId('code-card')
        .getByRole('textbox')
        .fill('print("edited")')
      const other = await page.context().newPage()
      await other.goto(url)
      await expect(
        other.getByTestId('code-card').getByRole('textbox')
      ).toHaveValue('print("starter")')
      await other.close()
    })

    test('keeps editing and warns when tab storage refuses writes', async ({
      page,
    }) => {
      await page.addInitScript(() => {
        const original = Storage.prototype.setItem
        Storage.prototype.setItem = function (key: string, value: string) {
          if (this === window.sessionStorage) throw new Error('blocked')
          return original.call(this, key, value)
        }
      })
      const thread = await seedCardThread(
        participantId,
        'python-core',
        'print("starter")'
      )
      await page.goto(`${chatUrl()}/${CHATBOT_ID}/threads/${thread.id}`)
      const card = page.getByTestId('code-card')
      await card.getByRole('textbox').fill('print("edited")')
      await expect(card.getByRole('textbox')).toHaveValue('print("edited")')
      await expect(card.getByTestId('code-card-storage-notice')).toBeVisible()
    })

    test('shows the card as unavailable when the mode no longer admits it', async ({
      page,
    }) => {
      const thread = await seedCardThread(
        participantId,
        'r-base',
        'cat("hidden")'
      )
      await setCodeExecutionPolicy({ modes: { tutor: ['python-core'] } })
      await page.goto(`${chatUrl()}/${CHATBOT_ID}/threads/${thread.id}`)
      const card = page.getByTestId('code-card')
      await expect(card.getByText(cardCopy.notAdmitted)).toBeVisible()
      await expect(card.getByRole('button', { name: copy.run })).toBeDisabled()
    })

    test('serves the runner documents with an opaque, network-less policy', async ({
      page,
    }) => {
      const thread = await seedCardThread(
        participantId,
        'python-core',
        'print(1)'
      )
      const runnerResponse = page.waitForResponse((response) =>
        /\/code-runtimes\/[0-9a-f]+\/runner-python\.html$/.test(
          new URL(response.url()).pathname
        )
      )
      await page.goto(`${chatUrl()}/${CHATBOT_ID}/threads/${thread.id}`)
      await page
        .getByTestId('code-card')
        .getByRole('button', { name: copy.run })
        .click()
      const csp = (await (await runnerResponse).allHeaders())[
        'content-security-policy'
      ]
      expect(csp).toContain('sandbox allow-scripts')
      expect(csp).toContain("default-src 'none'")
      expect(csp).toContain('connect-src blob:')
      expect(csp).not.toContain("'unsafe-eval'")
    })
  })

  test('shows Firefox an unavailable notice instead of running code', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'firefox', 'Firefox-only notice')
    const thread = await seedCardThread(
      participantId,
      'python-core',
      'print(1)'
    )
    await page.goto(`${chatUrl()}/${CHATBOT_ID}/threads/${thread.id}`)
    const card = page.getByTestId('code-card')
    await expect(card.getByText(copy.unsupportedBrowser)).toBeVisible()
    await expect(card.getByRole('button', { name: copy.run })).toBeDisabled()
  })
})
