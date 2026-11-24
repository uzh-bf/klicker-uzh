import { expect, test, type Page } from '@playwright/test'
import {
  CHATBOT_ID,
  chatUrl,
  clearChatCookies,
  ensureChatbotSeeded,
  getEnrolledParticipantId,
  resetChatState,
  seedThread,
  setDisclaimerState,
  setParticipantToken,
} from '../util/chat.js'

// The explainer service is not part of the E2E stack, so the page route is
// answered with a synthetic page that names its explanation.
function explanationPage(title: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="margin:0;font-family:sans-serif"><main style="padding:24px"><h1 data-title>${title}</h1><button type="button">Next step</button></main></body></html>`
}

function explanationCall(toolCallId: string, title: string) {
  return {
    type: 'tool-call' as const,
    toolCallId,
    toolName: 'show_explanation',
    args: {},
    result: {
      kind: 'explanation',
      content: { title, locale: 'en', steps: [] },
    },
  }
}

async function routeExplanationPages(page: Page) {
  await page.route('**/api/chatbots/*/explanations/page', async (route) => {
    const body = route.request().postDataJSON() as {
      content?: { title?: string }
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        html: explanationPage(body.content?.title ?? 'Untitled'),
      }),
    })
  })
}

async function openThreadWithExplanations(page: Page) {
  const thread = await seedThread(await getEnrolledParticipantId(), {
    title: 'Explanations',
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: 'Explain supply and demand' }],
      },
      {
        role: 'assistant',
        content: [
          explanationCall('call-supply', 'Supply curve'),
          { type: 'text', text: 'Here is the supply side.' },
        ],
      },
      {
        role: 'user',
        content: [{ type: 'text', text: 'And demand?' }],
      },
      {
        role: 'assistant',
        content: [
          explanationCall('call-demand', 'Demand curve'),
          { type: 'text', text: 'And here is the demand side.' },
        ],
      },
    ],
  })
  await page.goto(`${chatUrl()}/${CHATBOT_ID}/threads/${thread.id}`)
  await expect(page.getByTestId('explanation-open')).toHaveCount(2)
  await expect(page.getByTestId('explanation-open').first()).toBeEnabled()
}

test.beforeAll(async () => {
  await ensureChatbotSeeded()
})

test.beforeEach(async ({ page }) => {
  const participantId = await getEnrolledParticipantId()
  await clearChatCookies(page)
  await setParticipantToken(page, participantId)
  await resetChatState(participantId)
  await setDisclaimerState(participantId, 'accepted')
  await routeExplanationPages(page)
})

test('an explanation opens large beside a usable chat and steps through the thread', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openThreadWithExplanations(page)

  const opener = page.getByTestId('explanation-open').first()
  await opener.click()
  const panel = page.getByTestId('chat-explanation-panel')
  await expect(panel).toBeVisible()
  await expect(panel).toHaveAttribute('data-size', 'expanded')
  await expect(
    panel.frameLocator('iframe').getByRole('heading', { name: 'Supply curve' })
  ).toBeVisible()
  // One live copy: the inline card shrinks to a marker while the panel shows it.
  await expect(page.getByTestId('explanation-in-panel')).toHaveCount(1)

  // The conversation stays docked beside the large panel and accepts input.
  const conversation = await page
    .getByTestId('chat-conversation-pane')
    .boundingBox()
  const dock = await panel.boundingBox()
  expect(conversation!.x + conversation!.width).toBeLessThanOrEqual(dock!.x + 1)
  expect(dock!.width).toBeGreaterThan(conversation!.width)
  const input = page.getByTestId('chat-composer-input')
  await input.fill('Why does the curve slope upwards?')
  await expect(input).toHaveValue('Why does the curve slope upwards?')

  await expect(page.getByTestId('explanation-panel-position')).toHaveText(
    '1 of 2'
  )
  await page.getByTestId('explanation-panel-next').click()
  await expect(page.getByTestId('explanation-panel-position')).toHaveText(
    '2 of 2'
  )
  await expect(
    panel.frameLocator('iframe').getByRole('heading', { name: 'Demand curve' })
  ).toBeVisible()
  await expect(page.getByTestId('explanation-panel-next')).toBeDisabled()

  // Shrinking returns to the docked width; fullscreen hides the chat.
  await page.getByTestId('explanation-panel-enlarge').click()
  await expect(panel).toHaveAttribute('data-size', 'docked')
  await page.getByTestId('explanation-panel-enlarge').click()
  await expect(panel).toHaveAttribute('data-size', 'expanded')
  const fullscreen = page.getByTestId('explanation-panel-fullscreen')
  await fullscreen.click()
  await expect(panel).toHaveAttribute('data-fullscreen', 'true')
  expect(
    await input.evaluate((element) => Boolean(element.closest('[inert]')))
  ).toBe(true)
  await fullscreen.press('Escape')
  await expect(panel).toHaveAttribute('data-size', 'expanded')
  await expect(fullscreen).toBeFocused()

  await page.getByTestId('explanation-panel-panel-close').click()
  await expect(panel).toHaveCount(0)
  await expect(page.getByTestId('explanation-open').last()).toBeFocused()
  await expect(page.getByTestId('explanation-in-panel')).toHaveCount(0)
  await expect(input).toHaveValue('Why does the curve slope upwards?')
})

test('the graph and an explanation share one panel', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openThreadWithExplanations(page)
  const toggle = page.getByTestId('knowledge-graph-mode-link')
  test.skip(
    (await toggle.count()) === 0,
    'The concept map is not visible for this chatbot'
  )
  await toggle.click()
  await expect(page.getByTestId('chat-knowledge-graph-panel')).toBeVisible()
  await expect(page.getByTestId('chat-knowledge-graph-panel')).toHaveAttribute(
    'data-size',
    'docked'
  )
  await page.getByTestId('explanation-open').first().click()
  await expect(page.getByTestId('chat-explanation-panel')).toBeVisible()
  await expect(page.getByTestId('chat-knowledge-graph-panel')).toHaveCount(0)
})

test('on a phone the explanation replaces the conversation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openThreadWithExplanations(page)
  await page.getByTestId('explanation-open').first().click()
  const panel = page.getByTestId('chat-explanation-panel')
  await expect(panel).toBeVisible()
  await expect(page.getByTestId('chat-conversation-pane')).toBeHidden()
  await expect(page.getByTestId('explanation-panel-enlarge')).toBeHidden()
  const bounds = await panel.boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391)
  await page.getByTestId('explanation-panel-panel-close').click()
  await expect(page.getByTestId('chat-conversation-pane')).toBeVisible()
})
