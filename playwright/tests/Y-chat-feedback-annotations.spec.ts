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

// A synthetic learner paragraph inside instructions, so the card has to find
// the reviewed paragraph and leave the instructions out.
const LEARNER_MESSAGE =
  'Please check my paragraph against the rubric: claim, evidence, link back.\n\n' +
  'Diversification lowers portfolio risk. Assets that do not move together offset each other. ' +
  'Therefore investors should hold many stocks.\n\nThank you!'

const feedbackCall = {
  type: 'tool-call' as const,
  toolCallId: 'call-feedback',
  toolName: 'show_feedback',
  args: {},
  result: {
    kind: 'feedback',
    content: {
      format: 'feedback/1',
      title: 'Paragraph on diversification',
      summary: 'A clear claim with a good reason; the ending drifts.',
      strengths: [
        {
          text: 'The opening states the claim directly.',
          quote: 'Diversification lowers portfolio risk',
        },
      ],
      criteria: [
        {
          label: 'Claim',
          status: 'met',
          comment: 'The first sentence states it.',
          quote: 'Diversification lowers portfolio risk',
        },
        {
          label: 'Evidence',
          status: 'partial',
          comment: 'The reason is named but not shown with an example.',
          quote: 'Assets that do not move together offset each other',
        },
        {
          label: 'Link back',
          status: 'missing',
          comment:
            'The last sentence gives advice instead of returning to risk.',
          quote: '',
        },
      ],
      improvements: [
        {
          label: 'Return to the claim',
          comment: 'End by saying how holding many stocks lowers risk.',
          quote: 'Therefore investors should hold many stocks',
        },
      ],
      nextStep: 'Rewrite the last sentence so it refers to risk.',
    },
  },
}

async function openThreadWithFeedback(
  page: Page,
  learnerText = LEARNER_MESSAGE
) {
  const thread = await seedThread(await getEnrolledParticipantId(), {
    title: 'Feedback',
    messages: [
      { role: 'user', content: [{ type: 'text', text: learnerText }] },
      {
        role: 'assistant',
        content: [feedbackCall, { type: 'text', text: 'Here is my feedback.' }],
      },
    ],
  })
  await page.goto(`${chatUrl()}/${CHATBOT_ID}/threads/${thread.id}`)
  await expect(page.getByTestId('feedback-annotated')).toBeVisible()
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
})

test('feedback marks its remarks in the learner’s text, with a list and a panel', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openThreadWithFeedback(page)
  const card = page.locator('[data-feedback-card]')
  const marks = card.locator('[data-feedback-mark]')

  // The reviewed paragraph is shown without the instructions around it.
  await expect(card.getByTestId('feedback-annotated')).not.toContainText(
    'Please check my paragraph'
  )
  await expect(marks).toHaveCount(3)
  await expect(card.getByTestId('feedback-rollup')).toBeVisible()
  // The criterion without a quote stays visible as a note.
  await expect(card.getByTestId('feedback-notes')).toContainText('Link back')
  await page.screenshot({ path: test.info().outputPath('wide-annotated.png') })

  await marks.last().click()
  const rail = card.getByTestId('feedback-comment-rail')
  await expect(
    rail.locator('[data-feedback-comment="improvement-0"] button')
  ).toHaveAttribute('aria-pressed', 'true')
  await marks.first().press('Enter')
  await expect(marks.first()).toHaveAttribute('aria-pressed', 'true')
  await page.screenshot({ path: test.info().outputPath('wide-selected.png') })

  await card.getByTestId('feedback-view-list').click()
  await expect(card.getByTestId('feedback-annotated')).toHaveCount(0)
  await expect(card).toContainText('Return to the claim')
  await page.screenshot({ path: test.info().outputPath('wide-list.png') })
  await card.getByTestId('feedback-view-annotated').click()

  await card.getByTestId('feedback-open').click()
  const panel = page.getByTestId('chat-feedback-panel')
  await expect(panel).toBeVisible()
  await expect(panel.locator('[data-feedback-mark]')).toHaveCount(3)
  await expect(card.locator('[data-feedback-mark]')).toHaveCount(0)
  await page.screenshot({ path: test.info().outputPath('wide-panel.png') })
  await page.getByTestId('feedback-panel-panel-close').click()
  await expect(panel).toHaveCount(0)
  await expect(card.getByTestId('feedback-open')).toBeFocused()

  // A reload rebuilds the marks from the stored thread.
  await page.reload()
  await expect(page.locator('[data-feedback-mark]')).toHaveCount(3)
})

test('on a phone a remark opens below its paragraph and steps on', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openThreadWithFeedback(page)
  const card = page.locator('[data-feedback-card]')
  await expect(card.getByTestId('feedback-comment-rail')).toBeHidden()

  const marks = card.locator('[data-feedback-mark]')
  await marks.first().click()
  const drawer = card.getByTestId('feedback-comment-drawer')
  await expect(drawer).toBeVisible()
  await expect(marks.first()).toHaveAttribute('aria-pressed', 'true')
  await page.screenshot({ path: test.info().outputPath('phone-drawer.png') })
  await drawer.getByTestId('feedback-comment-next').click()
  await expect(marks.nth(1)).toHaveAttribute('aria-pressed', 'true')
  await expect(marks.nth(1)).toBeFocused()
  await marks.nth(1).press('Escape')
  await expect(drawer).toHaveCount(0)
})

test('feedback on an attached document marks the document text', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  // The stored message format of a typed question with one attached file.
  const withDocument =
    'Please check the attached paragraph against the rubric.\n\n' +
    '--- Attached document: essay.txt ---\n' +
    LEARNER_MESSAGE.split('\n\n')[1] +
    '\n--- End of attached document ---'
  await openThreadWithFeedback(page, withDocument)
  await expect(page.locator('[data-feedback-mark]')).toHaveCount(3)
})
