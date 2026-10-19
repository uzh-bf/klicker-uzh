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

      await card
        .getByRole('button', { name: enMessages.chat.workspace.open })
        .click()
      const workspace = page.getByTestId('chat-workspace-panel')
      await expect(workspace.getByTestId('code-card')).toBeVisible()
      await expect(page.getByTestId('artifact-opened')).toBeVisible()
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
      await expect(page.getByTestId('artifact-opened')).toHaveCount(0)
      const inline = page.getByTestId('code-card')
      await expect(inline.getByRole('textbox')).toHaveValue(
        'print("edited beside chat")'
      )
      await expect(inline.getByTestId('code-runner-output')).toContainText(
        'sum 199999990000000'
      )
      await expect(
        inline.getByRole('button', { name: enMessages.chat.workspace.open })
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

  test('closes the workspace when its branch is hidden and keeps the edit for the return', async ({
    page,
  }) => {
    const root = randomUUID()
    const answer = randomUUID()
    const card = cardOutput('python-core', 'print("starter")')
    const thread = await seedThread(participantId, {
      title: 'Branched code card',
      messages: [
        {
          id: root,
          role: 'user',
          content: [{ type: 'text', text: 'Explain loops' }],
          chatMode: 'tutor',
        },
        {
          id: answer,
          role: 'assistant',
          content: [{ type: 'text', text: 'Loops repeat work.' }],
          chatMode: 'tutor',
        },
        {
          parentId: answer,
          role: 'user',
          content: [{ type: 'text', text: 'Just the theory, please' }],
          chatMode: 'tutor',
          createdAt: new Date(Date.now() - 60_000),
        },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'No playground on this branch.' }],
          chatMode: 'tutor',
          createdAt: new Date(Date.now() - 59_000),
        },
        {
          parentId: answer,
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
              toolCallId: 'code-card-branch',
              toolName: 'open_code_card',
              args: { profile: card.profile, starterCode: card.starterCode },
              result: card,
            },
          ],
        },
      ],
    })
    await page.goto(`${chatUrl()}/${CHATBOT_ID}/threads/${thread.id}`)
    await page
      .getByTestId('code-card')
      .getByRole('button', { name: enMessages.chat.workspace.open })
      .click()
    const workspace = page.getByTestId('chat-workspace-panel')
    await workspace.getByRole('textbox').fill('print("edited")')

    await page.getByTestId('chat-branch-previous').first().click()
    await expect(page.getByText('No playground on this branch.')).toBeVisible()
    await expect(workspace).toHaveCount(0)
    await expect(page.getByTestId('code-card')).toHaveCount(0)

    await page.getByTestId('chat-branch-next').first().click()
    const inline = page.getByTestId('code-card')
    await expect(inline.getByRole('textbox')).toHaveValue('print("edited")')
    await expect(workspace).toHaveCount(0)
  })

  test.describe('practice card in the workspace', () => {
    // A synthetic answer-safe quiz result, as the chat route stores it.
    function practiceResult(expiresAt: Date) {
      return {
        kind: 'student-practice-quiz',
        questionRef: 'synthetic-question-ref',
        expiresAt: expiresAt.toISOString(),
        stack: {
          stackId: 1,
          stackTitle: 'Synthetic practice',
          elements: [
            {
              id: 10,
              type: 'PRACTICE_QUIZ',
              elementType: 'SC',
              elementData: {
                __typename: 'ChoicesElementData',
                id: '10',
                name: 'Choice',
                type: 'SC',
                content: 'Pick one option.',
                basePoints: true,
                pointsMultiplier: 1,
                options: {
                  hasSampleSolution: false,
                  displayMode: 'LIST',
                  choices: [
                    { ix: 0, value: 'Alpha' },
                    { ix: 1, value: 'Beta' },
                  ],
                },
              },
            },
            {
              id: 20,
              type: 'PRACTICE_QUIZ',
              elementType: 'FREE_TEXT',
              elementData: {
                __typename: 'FreeTextElementData',
                id: '20',
                name: 'Reasoning',
                type: 'FREE_TEXT',
                content: 'Explain your choice.',
                basePoints: true,
                pointsMultiplier: 1,
                options: { restrictions: { maxLength: 200 } },
              },
            },
          ],
        },
      }
    }

    async function openPracticeThread(page: Page, expiresAt: Date) {
      const result = practiceResult(expiresAt)
      const thread = await seedThread(participantId, {
        title: 'Practice thread',
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Quiz me' }],
            chatMode: 'tutor',
          },
          {
            role: 'assistant',
            chatMode: 'tutor',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'practice-seeded',
                toolName: 'start_student_practice_quiz',
                args: {},
                result,
              },
            ],
          },
        ],
      })
      await page.goto(`${chatUrl()}/${CHATBOT_ID}/threads/${thread.id}`)
      const card = page.getByTestId('practice-card')
      await expect(card).toBeVisible()
      return card
    }

    async function answer(page: Page, text: string) {
      await page.getByTestId('sc-0-answer-option-0').click()
      await page.getByRole('button', { name: 'Next' }).click()
      await page.getByTestId('free-text-input-1').fill(text)
    }

    const inAnHour = () => new Date(Date.now() + 60 * 60 * 1000)

    test('keeps answers and submits once while the card moves', async ({
      page,
    }) => {
      const bodies: unknown[] = []
      let release: () => void = () => {}
      const held = new Promise<void>((resolve) => {
        release = resolve
      })
      await page.route('**/practice/submit', async (route) => {
        bodies.push(route.request().postDataJSON())
        await held
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ result: { evaluations: [] } }),
        })
      })
      await openPracticeThread(page, inAnHour())
      await answer(page, 'Alpha fits best')

      await page
        .getByTestId('practice-card')
        .getByRole('button', { name: enMessages.chat.workspace.open })
        .click()
      const workspace = page.getByTestId('chat-workspace-panel')
      await expect(workspace.getByTestId('free-text-input-1')).toHaveValue(
        'Alpha fits best'
      )
      await expect(page.getByTestId('artifact-opened')).toBeVisible()

      // Two activations in one task reach the handler before React re-renders.
      await workspace
        .getByRole('button', { name: 'Submit' })
        .evaluate((button: HTMLButtonElement) => {
          button.click()
          button.click()
        })
      await expect.poll(() => bodies.length).toBe(1)
      await page
        .getByTestId('workspace-close')
        .or(page.getByTestId('workspace-back-to-chat'))
        .click()
      await expect(workspace).toHaveCount(0)
      release()

      const card = page.getByTestId('practice-card')
      await expect(card.getByTestId('sc-0-answer-option-0')).toBeDisabled()
      expect(bodies).toHaveLength(1)
      expect(bodies[0]).toMatchObject({
        questionRef: 'synthetic-question-ref',
        responses: [
          { instanceId: 10, choicesResponse: [{ ix: 0, selected: true }] },
          { instanceId: 20, freeTextResponse: 'Alpha fits best' },
        ],
      })
    })

    test('keeps the answer after a failed submission for an explicit retry', async ({
      page,
    }) => {
      let attempts = 0
      await page.route('**/practice/submit', (route) => {
        attempts += 1
        return attempts === 1
          ? route.fulfill({ status: 503, body: '' })
          : route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ result: { evaluations: [] } }),
            })
      })
      const card = await openPracticeThread(page, inAnHour())
      await answer(page, 'Retry me')
      const submit = card.getByRole('button', { name: 'Submit' })
      await submit.click()
      await expect(submit).toBeEnabled()
      expect(attempts).toBe(1)
      await expect(card.getByTestId('free-text-input-1')).toHaveValue(
        'Retry me'
      )
      await submit.click()
      await expect(card.getByTestId('sc-0-answer-option-0')).toBeDisabled()
      expect(attempts).toBe(2)
    })

    test('locks the card when the server no longer accepts the question', async ({
      page,
    }) => {
      let attempts = 0
      await page.route('**/practice/submit', (route) => {
        attempts += 1
        return route.fulfill({
          status: 410,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'QUESTION_REF_STALE' }),
        })
      })
      await openPracticeThread(page, inAnHour())
      await answer(page, 'Stale answer')
      await page
        .getByTestId('practice-card')
        .getByRole('button', { name: enMessages.chat.workspace.open })
        .click()
      const workspace = page.getByTestId('chat-workspace-panel')
      await workspace.getByRole('button', { name: 'Submit' }).click()
      await expect(
        workspace.getByRole('button', { name: 'Submit' })
      ).toHaveCount(0)
      expect(attempts).toBe(1)
    })

    test('locks a question that expired while its timer had not fired', async ({
      page,
    }) => {
      const now = new Date()
      await page.clock.install({ time: now })
      const requests: string[] = []
      await page.route('**/practice/submit', (route) => {
        requests.push(route.request().url())
        return route.abort()
      })
      const card = await openPracticeThread(
        page,
        new Date(now.getTime() + 60_000)
      )
      await answer(page, 'Too late')
      // Moves the wall clock past expiry without running the expiry timer.
      await page.clock.setSystemTime(new Date(now.getTime() + 120_000))
      await card.getByRole('button', { name: 'Submit' }).click()
      await expect(card.getByRole('button', { name: 'Submit' })).toHaveCount(0)
      expect(requests).toEqual([])
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
