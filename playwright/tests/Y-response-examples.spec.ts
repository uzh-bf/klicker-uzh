import { expect, test } from '../util/fixtures.js'
import { URL_MANAGE } from '../util/constants.js'
import { getPrisma } from '../global-setup.js'
import { seedResponseExamples } from '../../packages/prisma-data/src/data/seedResponseExamples.js'
import { chatUrl, ensureChatbotSeeded } from '../util/chat.js'
import { gotoCommit } from '../util/workflow.js'

const CHATBOT_ID_TEST = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
const CANDIDATE_ID = 'a1111111-1111-4111-8111-111111111111'
const NEEDS_REVIEW_ID = 'a2222222-2222-4222-8222-222222222222'
const APPROVED_ID = 'a3333333-3333-4333-8333-333333333333'
const REJECTED_ID = 'a4444444-4444-4444-8444-444444444444'

test.describe('Chatbot response-example review', () => {
  test('captures the first owner-preview answer and exposes its review link', async ({
    loginLecturer,
    page,
  }, testInfo) => {
    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    const question = 'Why does a higher discount rate reduce present value?'
    const answer = 'A higher discount rate reduces the present value. [1]'
    const textPartId = 'response-example-answer'
    let captureBody: unknown

    await ensureChatbotSeeded()
    await loginLecturer()
    await page.route(
      `**/api/manage/chatbots/${CHATBOT_ID_TEST}/preview/chat`,
      async (route) => {
        if (route.request().method() !== 'POST') return route.fallback()
        const stream = [
          { type: 'start' },
          { type: 'start-step' },
          { type: 'text-start', id: textPartId },
          { type: 'text-delta', id: textPartId, delta: answer },
          { type: 'text-end', id: textPartId },
          {
            type: 'data-response-example-receipt',
            data: {
              token: 'synthetic-signed-receipt',
              question,
              answer,
            },
          },
          { type: 'finish-step' },
          {
            type: 'finish',
            messageMetadata: {
              chatMode: 'tutor',
              finishReason: 'stop',
              modelId: 'gpt-4.1-mini',
            },
          },
        ]
          .map((part) => `data: ${JSON.stringify(part)}`)
          .concat('data: [DONE]')
          .join('\n\n')
          .concat('\n\n')

        await route.fulfill({
          status: 200,
          headers: {
            'content-type': 'text/event-stream',
            'x-vercel-ai-ui-message-stream': 'v1',
          },
          body: stream,
        })
      }
    )
    await page.route(
      `**/api/manage/chatbots/${CHATBOT_ID_TEST}/preview/capture`,
      async (route) => {
        captureBody = route.request().postDataJSON()
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            exampleId: CANDIDATE_ID,
            created: true,
            reviewUrl: `${manageUrl}/resources/chatbots?chatbotId=${CHATBOT_ID_TEST}&view=advanced&responseExampleId=${CANDIDATE_ID}`,
          }),
        })
      }
    )

    await page.goto(`${chatUrl()}/preview/${CHATBOT_ID_TEST}`, {
      waitUntil: 'domcontentloaded',
    })
    const composer = page.getByTestId('chat-composer-input')
    await page.getByTestId('chat-welcome-suggestion').first().click()
    await expect(composer).not.toHaveValue('')
    await composer.fill(question)
    await expect(composer).toHaveValue(question)
    await page.getByTestId('chat-send-button').click()

    const capture = page.getByTestId('owner-preview-response-example-capture')
    await expect(capture).toBeVisible()
    await expect(capture).not.toHaveAccessibleName('')
    await page.screenshot({
      path: testInfo.outputPath('response-example-capture-available.png'),
      fullPage: true,
    })

    await capture.click()
    await expect(
      page.getByTestId('owner-preview-response-example-status')
    ).toBeVisible()
    await expect(
      page.getByTestId('owner-preview-response-example-review')
    ).toHaveAttribute(
      'href',
      `${manageUrl}/resources/chatbots?chatbotId=${CHATBOT_ID_TEST}&view=advanced&responseExampleId=${CANDIDATE_ID}`
    )
    expect(captureBody).toEqual({
      receipt: 'synthetic-signed-receipt',
      question,
      answer,
    })
    await page.screenshot({
      path: testInfo.outputPath('response-example-capture-created.png'),
      fullPage: true,
    })
  })

  test('lets the owner review seeded examples without losing a stale draft', async ({
    loginLecturer,
    page,
  }, testInfo) => {
    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    const prisma = await getPrisma()
    await ensureChatbotSeeded()
    await seedResponseExamples(prisma)
    await loginLecturer()
    await gotoCommit(
      page,
      `${manageUrl}/resources/chatbots?chatbotId=${CHATBOT_ID_TEST}&view=advanced&responseExampleId=${CANDIDATE_ID}`
    )

    const review = page.getByTestId('response-examples-review')
    await expect(review).toBeVisible()
    await expect(review.getByTestId('response-examples-loading')).toBeHidden()

    const candidate = review.getByTestId(`response-example-${CANDIDATE_ID}`)
    const needsReview = review.getByTestId(
      `response-example-${NEEDS_REVIEW_ID}`
    )
    const approved = review.getByTestId(`response-example-${APPROVED_ID}`)
    const rejected = review.getByTestId(`response-example-${REJECTED_ID}`)

    await expect(candidate).toBeVisible()
    await expect(candidate).toHaveAttribute('data-focused', 'true')
    await expect(needsReview).toBeVisible()
    await expect(approved).toBeVisible()
    await expect(rejected).toBeVisible()
    await expect(
      candidate.getByTestId(`response-example-citation-parity-${CANDIDATE_ID}`)
    ).toBeVisible()
    await expect(
      needsReview.getByTestId(
        `response-example-citation-parity-${NEEDS_REVIEW_ID}`
      )
    ).toBeVisible()
    await expect(
      candidate.getByTestId(`response-example-approve-${CANDIDATE_ID}`)
    ).toBeEnabled()
    await expect(
      needsReview.getByTestId(`response-example-approve-${NEEDS_REVIEW_ID}`)
    ).toBeDisabled()
    await expect(
      rejected.getByTestId(`response-example-reject-${REJECTED_ID}`)
    ).toHaveCount(0)

    await page.screenshot({
      path: testInfo.outputPath('response-examples-en-desktop.png'),
      fullPage: true,
    })

    await candidate
      .getByTestId(`response-example-approve-${CANDIDATE_ID}`)
      .click()
    await expect
      .poll(
        async () =>
          (
            await prisma.responseExample.findUniqueOrThrow({
              where: { id: CANDIDATE_ID },
              select: { status: true },
            })
          ).status
      )
      .toBe('APPROVED')

    let staleOnce = true
    await page.route('**/graphql', async (route) => {
      const request = route.request()
      if (request.method() !== 'POST' || !staleOnce) {
        await route.continue()
        return
      }

      const operationName = (
        request.postDataJSON() as { operationName?: string }
      ).operationName
      if (operationName !== 'EditAndApproveResponseExample') {
        await route.continue()
        return
      }

      staleOnce = false
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          errors: [
            {
              message: 'Synthetic stale response-example update',
              extensions: { code: 'RESPONSE_EXAMPLE_STALE_UPDATE' },
            },
          ],
        }),
      })
    })

    await candidate
      .getByTestId(`response-example-edit-approve-${CANDIDATE_ID}`)
      .click()
    const modal = page.getByTestId('response-example-edit-modal')
    await expect(modal).toBeVisible()
    await expect(
      modal.getByTestId('response-example-edit-reference-answer')
    ).toBeVisible()

    const draftQuestion = 'A draft that must survive a stale update.'
    await modal
      .getByTestId('response-example-edit-question')
      .fill(draftQuestion)
    await modal.getByTestId('response-example-edit-submit').click()
    await expect(modal.getByTestId('response-example-edit-error')).toBeVisible()
    await expect(
      modal.getByTestId('response-example-edit-question')
    ).toHaveValue(draftQuestion)
    await expect(
      modal.getByTestId('response-example-edit-submit')
    ).toBeDisabled()

    await modal.getByTestId('response-example-edit-cancel').click()
    await expect(modal).toBeHidden()
    await candidate
      .getByTestId(`response-example-edit-approve-${CANDIDATE_ID}`)
      .click()
    await expect(page.getByTestId('response-example-edit-modal')).toBeVisible()

    const reopenedModal = page.getByTestId('response-example-edit-modal')
    const editedQuestion =
      'Why does a higher discount rate reduce present value?'
    await reopenedModal
      .getByTestId('response-example-edit-question')
      .fill(editedQuestion)
    await reopenedModal.getByTestId('response-example-edit-submit').click()
    await expect(reopenedModal).toBeHidden()
    await expect
      .poll(() =>
        prisma.responseExample.findUniqueOrThrow({
          where: { id: CANDIDATE_ID },
          select: { status: true, studentMessage: true },
        })
      )
      .toEqual({ status: 'APPROVED', studentMessage: editedQuestion })

    await needsReview
      .getByTestId(`response-example-reject-${NEEDS_REVIEW_ID}`)
      .click()
    await expect
      .poll(
        async () =>
          (
            await prisma.responseExample.findUniqueOrThrow({
              where: { id: NEEDS_REVIEW_ID },
              select: { status: true },
            })
          ).status
      )
      .toBe('REJECTED')
    await expect(
      needsReview.getByTestId(
        `response-example-edit-approve-${NEEDS_REVIEW_ID}`
      )
    ).toHaveCount(0)
  })
})
