import { expect, test } from '../util/fixtures.js'
import { URL_MANAGE } from '../util/constants.js'
import { gotoCommit } from '../util/workflow.js'

const CHATBOT_ID_TEST = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
const CANDIDATE_ID = 'a1111111-1111-4111-8111-111111111111'
const NEEDS_REVIEW_ID = 'a2222222-2222-4222-8222-222222222222'
const APPROVED_ID = 'a3333333-3333-4333-8333-333333333333'
const REJECTED_ID = 'a4444444-4444-4444-8444-444444444444'

test.describe('Chatbot response-example review', () => {
  test('lets the owner review seeded examples without losing a stale draft', async ({
    loginLecturer,
    page,
  }, testInfo) => {
    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    await loginLecturer()
    await gotoCommit(page, `${manageUrl}/resources/chatbots/${CHATBOT_ID_TEST}`)

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
    await expect(needsReview).toBeVisible()
    await expect(approved).toBeVisible()
    await expect(rejected).toBeVisible()
    await expect(
      candidate.getByTestId(`response-example-citation-parity-${CANDIDATE_ID}`)
    ).toContainText('All attached evidence is cited')
    await expect(
      needsReview.getByTestId(
        `response-example-citation-parity-${NEEDS_REVIEW_ID}`
      )
    ).toContainText('need review before approval')
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
    await expect(
      candidate.getByTestId(`response-example-status-${CANDIDATE_ID}`)
    ).toContainText('Approved')

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
    await expect(
      modal.getByTestId('response-example-edit-error')
    ).toContainText('changed while you were editing')
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
    await expect(
      candidate.getByTestId(`response-example-status-${CANDIDATE_ID}`)
    ).toContainText('Approved')

    await needsReview
      .getByTestId(`response-example-reject-${NEEDS_REVIEW_ID}`)
      .click()
    await expect(
      needsReview.getByTestId(`response-example-status-${NEEDS_REVIEW_ID}`)
    ).toContainText('Rejected')
    await expect(
      needsReview.getByTestId(
        `response-example-edit-approve-${NEEDS_REVIEW_ID}`
      )
    ).toHaveCount(0)
  })
})
