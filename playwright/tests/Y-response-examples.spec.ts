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
            reviewUrl: `${manageUrl}/resources/chatbots?chatbotId=${CHATBOT_ID_TEST}&view=knowledge&responseExampleId=${CANDIDATE_ID}`,
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
      `${manageUrl}/resources/chatbots?chatbotId=${CHATBOT_ID_TEST}&view=knowledge&responseExampleId=${CANDIDATE_ID}`
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
      `${manageUrl}/resources/chatbots?chatbotId=${CHATBOT_ID_TEST}&view=knowledge&responseExampleId=${CANDIDATE_ID}`
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
    await expect(candidate).toBeFocused()
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
    await expect(candidate).not.toBeFocused()
  })

  test('runs and replaces a baseline, then reloads its incomplete stale results', async ({
    loginLecturer,
    page,
  }, testInfo) => {
    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    await ensureChatbotSeeded()
    await seedResponseExamples(await getPrisma())
    await loginLecturer()

    const now = new Date().toISOString()
    const evidence = [
      {
        citationIndex: 1,
        sourceId: '55555555-5555-4555-8555-555555555555',
        chunkId: 'synthetic-chunk',
        contentHash: 'a'.repeat(64),
        citationAnchor: 'Synthetic source section',
      },
    ]
    type BaselineFixtureCase = {
      id: string
      exampleId: string
      chatMode: string
      question: string
      idealAnswer: string
      expectedEvidence: typeof evidence
      status: string
      actualAnswer: string | null
      actualEvidence: typeof evidence | null
      assessment: {
        status: string
        explanation: string
        sourceSupport: string
      } | null
    }
    type BaselineFixtureReport = {
      id: string
      status: string
      stale: boolean
      excludedCount: number
      createdAt: string
      updatedAt: string
      cases: BaselineFixtureCase[]
    }
    const completedReport = {
      __typename: 'ResponseExampleBaselineReport',
      modelId: 'gpt-6-luna',
      errorCode: null,
      id: 'synthetic-completed-report',
      status: 'COMPLETED',
      stale: false,
      excludedCount: 0,
      createdAt: now,
      updatedAt: now,
      cases: [
        {
          __typename: 'ResponseExampleBaselineCase',
          errorCode: null,
          id: 'synthetic-completed-case',
          exampleId: 'synthetic-example',
          chatMode: 'tutor',
          question: 'Synthetic completed case question',
          idealAnswer:
            '**Synthetic principle**\n\nThe expected answer connects the main idea to the course material and explains why the steps belong together. This fixture illustrates the amount of detail a lecturer can review. [1]\n\n1. Introduce the relevant concept.\n2. Explain its application to the question.\n3. Point out the limitation of the example.',
          expectedEvidence: evidence,
          status: 'COMPLETED',
          actualAnswer:
            '**Synthetic principle**\n\nThe chatbot explains the main idea in a few connected paragraphs. This test-owned example exercises the report layout with a longer response and a source marker. [1]\n\n1. Start from the concept in the course.\n2. Apply it to the question.\n3. Check the conclusion against the cited section.',
          actualEvidence: evidence,
          assessment: {
            status: 'PASS',
            explanation: 'Synthetic advisory assessment',
            sourceSupport: 'UNASSESSED',
          },
        },
      ],
    }
    const incompleteReport = {
      ...completedReport,
      id: 'synthetic-incomplete-report',
      status: 'INCOMPLETE',
      stale: true,
      cases: [
        {
          ...completedReport.cases[0],
          id: 'synthetic-unassessed-case',
          status: 'UNASSESSED',
          actualAnswer: null,
          actualEvidence: null,
          assessment: null,
        },
      ],
    }
    let report: BaselineFixtureReport | null = null
    let startCount = 0
    const replacementRequests: boolean[] = []
    let activeQueryCount = 0

    await page.route('**/graphql', async (route) => {
      const request = route.request()
      if (request.method() !== 'POST') return route.continue()
      const body = request.postDataJSON() as {
        operationName?: string
        variables?: { replaceActive?: boolean }
      }
      if (body.operationName === 'GetResponseExampleBaseline') {
        if (report?.status === 'QUEUED') {
          activeQueryCount += 1
          if (activeQueryCount > 1) report = { ...report, status: 'RUNNING' }
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              getResponseExampleBaseline: {
                __typename: 'ResponseExampleBaselineOverview',
                eligibleCount: 1,
                excludedCount: 0,
                available: true,
                report,
              },
            },
          }),
        })
        return
      }
      if (body.operationName === 'StartResponseExampleBaseline') {
        startCount += 1
        replacementRequests.push(body.variables?.replaceActive === true)
        if (startCount === 1) {
          report = {
            ...completedReport,
            id: 'synthetic-running-report',
            status: 'QUEUED',
            cases: [
              {
                ...completedReport.cases[0],
                id: 'synthetic-running-case',
                status: 'PENDING',
                actualAnswer: null,
                actualEvidence: null,
                assessment: null,
              },
            ],
          }
        } else {
          report = completedReport
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              startResponseExampleBaseline: {
                __typename: 'ResponseExampleBaselineOverview',
                eligibleCount: 1,
                excludedCount: 0,
                available: true,
                report,
              },
            },
          }),
        })
        return
      }
      await route.continue()
    })

    await gotoCommit(
      page,
      `${manageUrl}/resources/chatbots?chatbotId=${CHATBOT_ID_TEST}&view=knowledge`
    )
    const baseline = page.getByTestId('response-example-baseline')
    await expect(baseline).toBeVisible()
    await expect(
      baseline.getByTestId('response-example-baseline-start')
    ).toBeEnabled()
    await baseline.getByTestId('response-example-baseline-start').click()
    await expect(baseline).toHaveAttribute('data-report-status', 'QUEUED')
    await expect(baseline).toHaveAttribute('data-report-status', 'RUNNING')

    await baseline.getByTestId('response-example-baseline-start').click()
    const replacementModal = page.getByTestId(
      'response-example-baseline-replace-modal'
    )
    await expect(replacementModal).toBeVisible()
    await replacementModal
      .getByTestId('response-example-baseline-replace-cancel')
      .click()
    await expect(replacementModal).toBeHidden()
    expect(startCount).toBe(1)

    await baseline.getByTestId('response-example-baseline-start').click()
    await page
      .getByTestId('response-example-baseline-replace-modal')
      .getByTestId('response-example-baseline-replace-confirm')
      .click()
    await expect(baseline).toHaveAttribute('data-report-status', 'COMPLETED')
    expect(startCount).toBe(2)
    expect(replacementRequests).toEqual([false, true])

    const completedCase = baseline.getByTestId('response-example-baseline-case')
    await expect(completedCase).toHaveAttribute('data-case-status', 'COMPLETED')
    await expect(completedCase).toHaveAttribute(
      'data-assessment-status',
      'PASS'
    )
    await completedCase.locator('summary').click()
    const actual = completedCase.getByTestId(
      'response-example-baseline-answer-actual'
    )
    const ideal = completedCase.getByTestId(
      'response-example-baseline-answer-ideal'
    )
    await expect(actual.locator('strong')).toHaveCount(1)
    await expect(ideal.locator('strong')).toHaveCount(1)
    const actualCitationTarget = actual
      .locator('li[id^="response-example-citation-"]')
      .first()
    const idealCitationTarget = ideal
      .locator('li[id^="response-example-citation-"]')
      .first()
    const actualCitationLink = actual.locator(
      'a[href^="#response-example-citation-"]'
    )
    const idealCitationLink = ideal.locator(
      'a[href^="#response-example-citation-"]'
    )
    await expect(actualCitationLink).toHaveAttribute(
      'href',
      `#${await actualCitationTarget.getAttribute('id')}`
    )
    await expect(idealCitationLink).toHaveAttribute(
      'href',
      `#${await idealCitationTarget.getAttribute('id')}`
    )
    expect(await actualCitationLink.getAttribute('href')).not.toBe(
      await idealCitationLink.getAttribute('href')
    )

    await baseline.screenshot({
      path: testInfo.outputPath('baseline-completed-desktop.png'),
    })
    await page.setViewportSize({ width: 720, height: 1000 })
    await baseline.screenshot({
      path: testInfo.outputPath('baseline-completed-compact.png'),
    })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(
      `${manageUrl}/de/resources/chatbots?chatbotId=${CHATBOT_ID_TEST}&view=knowledge`,
      { waitUntil: 'domcontentloaded' }
    )
    await expect(baseline).toHaveAttribute('data-report-status', 'COMPLETED')
    await baseline
      .getByTestId('response-example-baseline-case')
      .locator('summary')
      .click()
    await baseline.screenshot({
      path: testInfo.outputPath('baseline-completed-de.png'),
    })
    report = incompleteReport
    await page.reload({ waitUntil: 'domcontentloaded' })
    const reloadedBaseline = page.getByTestId('response-example-baseline')
    await expect(reloadedBaseline).toHaveAttribute(
      'data-report-status',
      'INCOMPLETE'
    )
    await expect(reloadedBaseline).toHaveAttribute('data-report-stale', 'true')
    const unassessedCase = reloadedBaseline.getByTestId(
      'response-example-baseline-case'
    )
    await expect(unassessedCase).toHaveAttribute(
      'data-case-status',
      'UNASSESSED'
    )
    await expect(unassessedCase).toHaveAttribute(
      'data-assessment-status',
      'UNASSESSED'
    )
    await unassessedCase.locator('summary').click()
    await reloadedBaseline.screenshot({
      path: testInfo.outputPath('baseline-incomplete-stale.png'),
    })
  })
})
