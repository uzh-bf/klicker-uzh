import type { Page } from '@playwright/test'
import { test } from '../../util/fixtures.js'
import type { StackType } from '../../util/fixtures/activities.js'
import { searchAndEdit } from '../../util/fixtures/elements.js'
import {
  createStacks,
  env,
  loginLecturer,
  loginStudent,
  runTask,
  selectOption,
} from '../../util/workflow.js'
import {
  COURSE,
  CT1,
  QR,
  QUIZ,
  SC1,
  SC2,
  captureEvidence,
  deMessages,
  expect,
  messages,
  setLocale,
  timerSeconds,
} from './shared.js'

// Wizard flow of createPracticeQuiz (activities fixture) extended with the
// escape-room settings on the settings step and hint authoring on the
// stacks step.
async function createEscapeRoomPracticeQuiz(
  page: Page,
  {
    name,
    displayName,
    description,
    courseName,
    stacks,
    timeLimitMinutes,
    hintPenaltySeconds,
    introText,
    hints,
  }: {
    name: string
    displayName: string
    description: string
    courseName: string
    stacks: StackType[]
    timeLimitMinutes: string
    hintPenaltySeconds: string
    introText: string
    hints: { stackIx: number; elementIx: number; text: string }[]
  }
) {
  await page.getByTestId('create-practice-quiz').click()

  await page.getByTestId('insert-practice-quiz-name').fill(name)
  await page.getByTestId('next-or-submit').click()

  await page.getByTestId('insert-practice-quiz-display-name').fill(displayName)
  await page.getByTestId('insert-practice-quiz-description').click()
  await page
    .getByTestId('insert-practice-quiz-description')
    .pressSequentially(description)
  await page.getByTestId('next-or-submit').click()

  await selectOption(page, '[data-cy="select-course"]', courseName)
  await expect(page.getByTestId('select-course')).toContainText(courseName)

  // enable escape mode: the numeric settings and intro story only render
  // once the checkbox is toggled, and the order selector locks to sequential
  await expect(page.getByTestId('escape-room-time-limit')).not.toBeAttached()
  await page.getByTestId('toggle-escape-room').click()
  await expect(page.getByTestId('escape-room-time-limit')).toBeVisible()
  await expect(page.getByTestId('select-order')).toBeDisabled()
  await page.getByTestId('escape-room-time-limit').fill(timeLimitMinutes)
  await page.getByTestId('escape-room-hint-penalty').fill(hintPenaltySeconds)
  await page.getByTestId('escape-room-intro-text').fill(introText)
  await page.getByTestId('next-or-submit').click()

  await createStacks(page, { stacks })
  for (const hint of hints) {
    await page
      .getByTestId(`escape-room-hint-stack-${hint.stackIx}-${hint.elementIx}`)
      .fill(hint.text)
  }
  await page.getByTestId('next-or-submit').click()
}

export function registerPracticeEscapeRoomTests() {
  test('Create an escape room practice quiz with settings, intro story, and a hint', async ({
    page: testPage,
  }, testInfo) => {
    const page = testPage
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('library').click()
    await createEscapeRoomPracticeQuiz(page, {
      name: QUIZ.name,
      displayName: QUIZ.displayName,
      description: QUIZ.description,
      courseName: COURSE,
      stacks: [
        { elements: [SC1.title] },
        { elements: [SC2.title] },
        { elements: [CT1.title] },
      ],
      timeLimitMinutes: QUIZ.timeLimitMinutes,
      hintPenaltySeconds: QUIZ.hintPenaltySeconds,
      introText: QUIZ.introText,
      hints: [{ stackIx: 0, elementIx: 0, text: QUIZ.hint }],
    })
    await page.getByTestId('open-activity-overview').click()
    await page.waitForURL(/\/courses\/.*tab=practiceQuizzes/)
    await expect(
      page.getByTestId(`activity-PRACTICE_QUIZ-${QUIZ.name}`)
    ).toBeAttached({ timeout: 60_000 })
    await expect(page.getByTestId(`status-${QUIZ.name}-DRAFT`)).toBeAttached()
  })

  test('Verify that the escape room settings prefill when editing the draft', async ({
    page: testPage,
  }, testInfo) => {
    const page = testPage
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${COURSE}`).click()
    await page.getByTestId('tab-practiceQuizzes').click()
    await page.getByTestId(`actions-PRACTICE_QUIZ-${QUIZ.name}`).click()
    await page.getByTestId(`edit-practice-quiz-${QUIZ.name}`).click()
    await expect(page.getByTestId('insert-practice-quiz-name')).toHaveValue(
      QUIZ.name
    )
    await page.getByTestId('next-or-submit').click()
    await expect(
      page.getByTestId('insert-practice-quiz-display-name')
    ).toHaveValue(QUIZ.displayName)
    await page.getByTestId('next-or-submit').click()
    // the escape fields only render when the stored config was loaded, so
    // their presence and values cover the create + prefill round-trip
    await expect(page.getByTestId('escape-room-time-limit')).toHaveValue(
      QUIZ.timeLimitMinutes
    )
    await expect(page.getByTestId('escape-room-hint-penalty')).toHaveValue(
      QUIZ.hintPenaltySeconds
    )
    await expect(page.getByTestId('escape-room-intro-text')).toHaveValue(
      QUIZ.introText
    )
    await expect(page.getByTestId('select-order')).toBeDisabled()
    // leave the wizard without saving so the authored hint stays untouched
    await page.getByTestId('courses').click()
  })

  test('Publish the escape room practice quiz', async ({
    page: testPage,
  }, testInfo) => {
    const page = testPage
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${COURSE}`).click()
    await page.getByTestId('tab-practiceQuizzes').click()
    await page.getByTestId(`publish-practice-quiz-${QUIZ.name}`).click()
    await page.getByTestId('publish-practice-quiz-immediately').click()
    await expect(
      page.getByTestId(`status-${QUIZ.name}-PUBLISHED`)
    ).toBeAttached()
  })

  test('Student sees the intro story and starts the attempt', async ({
    page: testPage,
  }, testInfo) => {
    const page = testPage
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await page.addInitScript(() => {
      const realNow = Date.now
      Date.now = () => realNow() + 6 * 60 * 60 * 1000
    })
    await loginStudent(page)
    await page.getByTestId('quizzes').click()
    await page.getByTestId(`practice-quiz-${QUIZ.displayName}`).click()

    // start overlay with the authored intro story and the stats row
    await expect(
      page.getByText(messages.pwa.practiceQuiz.escapeRoomStartTitle).first()
    ).toBeVisible()
    await expect(
      page.getByTestId('escape-room-intro-text-display')
    ).toContainText(QUIZ.introText)
    await expect(
      page.getByText(`${QUIZ.timeLimitMinutes} min`).first()
    ).toBeVisible()
    await expect(
      page.getByText(`+${QUIZ.hintPenaltySeconds}s`).first()
    ).toBeVisible()

    await page.getByTestId('escape-room-start').click()

    // the overlay flips to the sticky in-progress banner with timer and
    // stage progress; the overview below shows the one-attempt info row
    await expect(page.getByTestId('escape-room-progress-chip')).toHaveText(
      /0\s*\/\s*3/
    )
    await expect(page.getByRole('timer')).toHaveText(/^(?:30:00|29:\d{2})$/)
    await expect(
      page.getByTestId('practice-quiz-escape-room-info')
    ).toBeVisible()

    await page.getByTestId('start-practice-quiz').click()
    await expect(page.getByText(SC1.content).first()).toBeVisible()
    // server-side masking: only the first uncleared stack is delivered, so
    // the progress bar must not contain steps for locked stacks yet
    await expect(page.getByTestId('practice-quiz-progress-0')).toBeAttached()
    await expect(
      page.getByTestId('practice-quiz-progress-1')
    ).not.toBeAttached()
  })

  test('Reveal a hint at the cost of a time penalty and clear the first stage', async ({
    page: testPage,
  }, testInfo) => {
    const page = testPage
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await page.addInitScript(() => {
      const realNow = Date.now
      Date.now = () => realNow() - 6 * 60 * 60 * 1000
    })
    await loginStudent(page)
    await page.getByTestId('quizzes').click()
    await page.getByTestId(`practice-quiz-${QUIZ.displayName}`).click()
    await page.getByTestId('start-practice-quiz').click()
    await expect(page.getByText(SC1.content).first()).toBeVisible()
    const beforeHint = timerSeconds(
      (await page.getByRole('timer').textContent()) ?? '0:00'
    )

    const hintButton = page
      .locator('[data-cy^="request-escape-room-hint-"]')
      .first()
    await expect(hintButton).toContainText(
      messages.pwa.practiceQuiz.escapeRoomRequestHint.replace(
        '{penalty}',
        QUIZ.hintPenaltySeconds
      )
    )
    await hintButton.click()
    await expect(
      page.locator('[data-cy^="escape-room-hint-text-"]').first()
    ).toContainText(QUIZ.hint)
    await expect(hintButton).not.toBeAttached()

    await page.reload()
    await page.getByTestId('start-practice-quiz').click()
    await expect(page.getByText(SC1.content).first()).toBeVisible()
    await expect(
      page.locator('[data-cy^="escape-room-hint-text-"]').first()
    ).toContainText(QUIZ.hint)
    await expect(
      page.locator('[data-cy^="request-escape-room-hint-"]')
    ).not.toBeAttached()
    const afterHint = timerSeconds(
      (await page.getByRole('timer').textContent()) ?? '0:00'
    )
    expect(afterHint).toBeLessThanOrEqual(beforeHint - 25)

    await page.getByTestId('sc-0-answer-option-0').click()
    await page.getByTestId('student-stack-submit').click()
    await page.getByTestId('student-stack-continue').click()

    // correct answer unmasks and advances to the second stage
    await expect(page.getByText(SC2.content).first()).toBeVisible()
    await expect(page.getByTestId('escape-room-progress-chip')).toHaveText(
      /1\s*\/\s*3/
    )
    await expect(page.getByTestId('practice-quiz-progress-1')).toBeAttached()
    await expect(
      page.getByTestId('practice-quiz-progress-2')
    ).not.toBeAttached()
  })

  test('Server rejects future hints and non-participant escape submissions', async ({
    page: testPage,
  }, testInfo) => {
    const page = testPage
    testInfo.setTimeout(600_000)

    const quiz = (await runTask('getEscapeRoomQuizStacks', {
      quizName: QUIZ.name,
    })) as {
      id: string
      courseId: string
      stacks: { id: number; order: number; instanceIds: number[] }[]
    }
    const lockedStack = quiz.stacks[2]!

    // authenticated participant with the in-progress attempt from the
    // previous test: requesting the hint of a locked future stack is
    // rejected by the sequential gate at the API. The backend only reads
    // the participant cookie for requests with a PWA origin header, so a
    // direct API call must authenticate via the Bearer fallback instead.
    await loginStudent(page)
    const participantToken = (await page.context().cookies()).find(
      (cookie) => cookie.name === 'participant_token'
    )?.value
    expect(participantToken).toBeTruthy()
    const hintResponse = await page.request.post(
      `${env('URL_API')}/api/graphql`,
      {
        headers: {
          'x-graphql-yoga-csrf': '1',
          authorization: `Bearer ${participantToken}`,
        },
        data: {
          operationName: 'RequestEscapeRoomHint',
          query: `mutation RequestEscapeRoomHint($practiceQuizId: String, $instanceId: Int!) {
            requestEscapeRoomHint(practiceQuizId: $practiceQuizId, instanceId: $instanceId) { hint }
          }`,
          variables: {
            practiceQuizId: quiz.id,
            instanceId: lockedStack.instanceIds[0],
          },
        },
      }
    )
    const hintBody = await hintResponse.json()
    expect(hintBody.data?.requestEscapeRoomHint ?? null).toBeNull()
    expect(hintBody.errors?.[0]?.extensions?.code).toBe('ESCAPE_ROOM_GATED')

    // an anonymous caller (no participant cookie) must not receive a
    // grading oracle for an escape room stack
    const anonResponse = await page
      .context()
      .browser()!
      .newContext()
      .then(async (anonContext) => {
        const response = await anonContext.request.post(
          `${env('URL_API')}/api/graphql`,
          {
            headers: { 'x-graphql-yoga-csrf': '1' },
            data: {
              operationName: 'RespondToElementStack',
              query: `mutation RespondToElementStack($stackId: Int!, $courseId: String!, $responses: [StackResponseInput!]!, $stackAnswerTime: Int!) {
                respondToElementStack(stackId: $stackId, courseId: $courseId, responses: $responses, stackAnswerTime: $stackAnswerTime) { id status }
              }`,
              variables: {
                stackId: lockedStack.id,
                courseId: quiz.courseId,
                stackAnswerTime: 5,
                responses: [
                  {
                    instanceId: lockedStack.instanceIds[0],
                    type: 'CONTENT',
                    contentReponse: true,
                  },
                ],
              },
            },
          }
        )
        const body = await response.json()
        await anonContext.close()
        return body
      })
    expect(anonResponse.data?.respondToElementStack ?? null).toBeNull()
    expect(anonResponse.errors?.[0]?.extensions?.code).toBe(
      'ESCAPE_ROOM_FORBIDDEN'
    )
  })

  test('Wrong answer stays on the stage and a rapid resubmit hits the lockout', async ({
    page: testPage,
  }, testInfo) => {
    const page = testPage
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await page.addInitScript(() => {
      const realNow = Date.now
      Date.now = () => realNow() + 12 * 60 * 60 * 1000
    })
    await loginStudent(page)
    await page.getByTestId('quizzes').click()
    await page.getByTestId(`practice-quiz-${QUIZ.displayName}`).click()
    await page.getByTestId('start-practice-quiz').click()
    await page.getByTestId('practice-quiz-progress-1').click()
    await expect(page.getByText(SC2.content).first()).toBeVisible()

    // wrong answer: grading sets a server-side lockout window
    await page.getByTestId('sc-0-answer-option-1').click()
    await page.getByTestId('student-stack-submit').click()
    await page.getByTestId('student-stack-continue').click()

    // the stage remounts for a retry instead of advancing or leaving
    await expect(page.getByText(SC2.content).first()).toBeVisible()
    await expect(page.getByTestId('student-stack-submit')).toBeDisabled()

    // resubmitting within the lockout window surfaces the countdown and
    // keeps the submit disabled (clicks must land within ~5s of grading)
    await page.getByTestId('sc-0-answer-option-1').click()
    await page.getByTestId('student-stack-submit').click()
    await expect(
      page.getByTestId('escape-room-lockout-countdown')
    ).toBeVisible()
    await expect(page.getByTestId('student-stack-submit')).toBeDisabled()

    // once the lockout elapses the stage can be solved
    await expect(page.getByTestId('student-stack-submit')).toBeEnabled({
      timeout: 15_000,
    })
    await page.getByTestId('sc-0-answer-option-0').click()
    await page.getByTestId('student-stack-submit').click()
    await page.getByTestId('student-stack-continue').click()
    await expect(page.getByText(CT1.content).first()).toBeVisible()
    await expect(page.getByTestId('escape-room-progress-chip')).toHaveText(
      /2\s*\/\s*3/
    )
  })

  test('Complete the final stage and see the completion stats', async ({
    page: testPage,
  }, testInfo) => {
    const page = testPage
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await page.getByTestId('quizzes').click()
    await page.getByTestId(`practice-quiz-${QUIZ.displayName}`).click()
    await page.getByTestId('start-practice-quiz').click()
    await page.getByTestId('practice-quiz-progress-2').click()
    await expect(page.getByText(CT1.content).first()).toBeVisible()

    await page.getByTestId('practice-quiz-mark-all-as-read').click()
    await page.getByTestId('student-stack-submit').click()

    // clearing the last stage completes the server-side attempt and the
    // completion overlay with escape stats takes over
    await expect(
      page.getByText(messages.pwa.practiceQuiz.escapeRoomCompletedTitle).first()
    ).toBeVisible()
    const stats = page.getByTestId('escape-room-completed-stats')
    await expect(stats).toBeVisible()
    await expect(stats).toContainText(
      messages.pwa.practiceQuiz.escapeRoomStatsHints
    )
    // one revealed hint charged the configured penalty
    await expect(stats).toContainText(
      messages.pwa.practiceQuiz.escapeRoomStatsPenalty
    )
  })

  test('Lecturer sees the completed attempt on the dashboard and resets it', async ({
    page: testPage,
  }, testInfo) => {
    const page = testPage
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    const quiz = (await runTask('getPracticeQuizInfo', {
      quizName: QUIZ.name,
    })) as { id: string; courseId: string } | null
    if (quiz === null) {
      throw new Error('Practice quiz not found')
    }
    await page.goto(`${env('URL_MANAGE')}/practiceQuiz/${quiz.id}/evaluation`, {
      waitUntil: 'commit',
    })
    const escapeRoomEvaluation = page.getByTestId('evaluation-escape-room')
    await expect(escapeRoomEvaluation).toBeVisible({ timeout: 60_000 })
    await escapeRoomEvaluation.click()
    await expect(page.getByTestId('escape-room-progress-table')).toBeVisible()
    const attemptRow = page
      .locator('[data-cy^="escape-room-attempt-"]')
      .filter({ hasText: messages.manage.evaluation.escapeRoomStatusCompleted })
      .first()
    await expect(attemptRow).toBeVisible()
    await expect(attemptRow).toContainText(
      messages.manage.evaluation.escapeRoomStatusCompleted
    )
    await expect(
      page
        .getByText(messages.manage.evaluation.escapeRoomStatusNotStarted)
        .first()
    ).toBeVisible()

    // two-step reset: the confirm button replaces the reset button
    await attemptRow
      .locator(
        '[data-cy^="escape-room-reset-"]:not([data-cy^="escape-room-reset-confirm-"])'
      )
      .first()
      .click()
    const cancelReset = attemptRow
      .locator('[data-cy^="escape-room-reset-cancel-"]')
      .first()
    await expect(cancelReset).toBeVisible()
    await cancelReset.click()
    await attemptRow
      .locator(
        '[data-cy^="escape-room-reset-"]:not([data-cy^="escape-room-reset-confirm-"]):not([data-cy^="escape-room-reset-cancel-"])'
      )
      .first()
      .click()
    await attemptRow
      .locator('[data-cy^="escape-room-reset-confirm-"]')
      .first()
      .click()
    await expect(attemptRow).not.toBeAttached()
    await expect(page.getByTestId('escape-room-progress-table')).toBeVisible()
  })

  test('Student can start a fresh attempt after the reset', async ({
    page: testPage,
  }, testInfo) => {
    const page = testPage
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await page.getByTestId('quizzes').click()
    await page.getByTestId(`practice-quiz-${QUIZ.displayName}`).click()
    await expect(page.getByTestId('escape-room-start')).toBeVisible()
    await expect(
      page.getByTestId('escape-room-intro-text-display')
    ).toContainText(QUIZ.introText)
  })
}

export function registerQrFallbackTest() {
  test('QR scanner denial falls back to a validated manual code', async ({
    page: testPage,
  }, testInfo) => {
    const page = testPage
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)

    await loginLecturer(page)
    await page.getByTestId('library').click()
    await createEscapeRoomPracticeQuiz(page, {
      name: QR.quizName,
      displayName: QR.quizDisplayName,
      description: 'QR scanner fallback workflow',
      courseName: COURSE,
      stacks: [{ elements: [QR.title] }],
      timeLimitMinutes: '30',
      hintPenaltySeconds: '30',
      introText: 'Find the marker and enter its code.',
      hints: [],
    })
    await page.getByTestId('open-activity-overview').click()
    await page.waitForURL(/\/courses\/.*tab=practiceQuizzes/)
    await page.getByTestId(`publish-practice-quiz-${QR.quizName}`).click()
    await page.getByTestId('publish-practice-quiz-immediately').click()
    await expect(
      page.getByTestId(`status-${QR.quizName}-PUBLISHED`)
    ).toBeAttached()

    await page.getByTestId('library').click()
    await searchAndEdit(page, QR.title)
    const printPagePromise = page.waitForEvent('popup')
    await page.getByTestId('open-qr-print-view').click()
    const printPage = await printPagePromise
    await expect(printPage.getByTestId('print-qr-sheets')).toBeVisible()
    await expect(printPage.getByTestId('qr-print-decoy-count')).toHaveValue('3')
    await captureEvidence(printPage, 'qr-print-en-desktop.png')
    await printPage.close()

    await page.addInitScript(() => {
      Object.defineProperty(globalThis, 'BarcodeDetector', {
        configurable: true,
        value: class {
          detect() {
            return Promise.resolve([])
          }
        },
      })
      ;(globalThis as any).__qrCameraCalls = 0
      navigator.mediaDevices.getUserMedia = () => {
        ;(globalThis as any).__qrCameraCalls += 1
        return new Promise((_, reject) => {
          ;(globalThis as any).__rejectQrCamera = () =>
            reject(new DOMException('Permission denied', 'NotAllowedError'))
        })
      }
    })
    await loginStudent(page)
    await page.getByTestId('quizzes').click()
    await page.getByTestId(`practice-quiz-${QR.quizDisplayName}`).click()
    await page.getByTestId('escape-room-start').click()
    await page.setViewportSize({ width: 390, height: 844 })
    await setLocale(page, 'de')
    await page.getByTestId('start-practice-quiz').click()
    await expect(page.getByText(QR.content).first()).toBeVisible()

    const startScanner = page.locator('[data-cy="start-qr-scanner"]')
    await startScanner.click()
    await expect(startScanner).toBeDisabled()
    await startScanner.evaluate((button: HTMLButtonElement) => button.click())
    expect(await page.evaluate(() => (globalThis as any).__qrCameraCalls)).toBe(
      1
    )
    await page.evaluate(() => (globalThis as any).__rejectQrCamera())
    await expect(page.getByRole('status')).toContainText(
      deMessages.shared.QR_SCAN.cameraFallback
    )
    const manualCode = page.getByLabel(deMessages.shared.QR_SCAN.manualLabel)
    await captureEvidence(page, 'qr-manual-fallback-de-mobile.png')
    await manualCode.fill('not-a-code')
    await expect(page.getByTestId('student-stack-submit')).toBeDisabled()
    await manualCode.fill(QR.code)
    await expect(page.getByTestId('student-stack-submit')).toBeEnabled()
    await page.getByTestId('student-stack-submit').click()
    await expect(
      page
        .getByText(deMessages.pwa.practiceQuiz.escapeRoomCompletedTitle)
        .first()
    ).toBeVisible()
  })
}
