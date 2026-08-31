import { test } from '../../util/fixtures.js'
import {
  acceptGamifiedLiveQuizAccountPrompt,
  createStacks,
  env,
  loginLecturer,
  loginStudentPassword,
  openStudentLiveQuiz,
  selectOption,
} from '../../util/workflow.js'
import {
  COURSE,
  LIVE,
  SC1,
  captureEvidence,
  createStudentPage,
  deMessages,
  expect,
  messages,
  setLocale,
} from './shared.js'

export function registerLiveQuizEscapeRoomTests() {
  test('Author a LiveQuiz escape-room block and confirm the time limit round-trips in minutes on edit', async ({
    page: testPage,
  }, testInfo) => {
    const page = testPage
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)

    // --- create: minimal live quiz carrying a single escape-room block ---
    await page.getByTestId('create-live-quiz').click()
    await page.getByTestId('insert-live-quiz-name').fill(LIVE.name)
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('insert-live-display-name').fill(LIVE.displayName)
    await page.getByTestId('insert-live-description').click()
    await page
      .getByTestId('insert-live-description')
      .pressSequentially(LIVE.description)
    await page.getByTestId('next-or-submit').click()
    await selectOption(page, '[data-cy="select-course"]', COURSE)
    await expect(page.getByTestId('select-course')).toContainText(COURSE)
    await page.getByTestId('next-or-submit').click()

    // blocks step: one block holding one SC element, then enable escape mode
    // on that block through its countdown modal. The escape settings only
    // render once the checkbox is toggled.
    await createStacks(page, {
      stacks: [{ elements: [SC1.title] }],
      type: 'block',
    })
    await page.getByTestId('open-block-0-countdown').click()
    await expect(page.getByTestId('escape-room-time-limit')).not.toBeAttached()
    await page.getByTestId('toggle-escape-room').click()
    await expect(page.getByTestId('escape-room-time-limit')).toBeVisible()
    await page.getByTestId('escape-room-time-limit').fill(LIVE.timeLimitMinutes)
    await page
      .getByTestId('escape-room-hint-penalty')
      .fill(LIVE.hintPenaltySeconds)
    await page.getByTestId('escape-room-intro-text').fill(LIVE.introText)
    await page.getByTestId('close-block-countdown').click()

    // submit the live quiz
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)

    // --- edit: reopen the wizard and step through to the block config ---
    await page.getByTestId('activities').click()
    await page.getByTestId('activities-search-input').fill(LIVE.name)
    await page.getByTestId('activities-search-input').press('Enter')
    await page.getByTestId(`actions-LIVE_QUIZ-${LIVE.name}`).click()
    await page.getByTestId(`edit-live-quiz-${LIVE.name}`).click()
    await expect(page.getByTestId('insert-live-quiz-name')).toHaveValue(
      LIVE.name
    )
    await page.getByTestId('next-or-submit').click()
    await expect(page.getByTestId('insert-live-display-name')).toHaveValue(
      LIVE.displayName
    )
    await page.getByTestId('next-or-submit').click()
    await page.getByTestId('next-or-submit').click()

    // the escape settings prefill from the stored config. The time limit must
    // come back in MINUTES (stored server-side as seconds) - pre-fix this
    // showed the raw seconds (300) instead of 5.
    await page.getByTestId('open-block-0-countdown').click()
    await expect(page.getByTestId('escape-room-time-limit')).toHaveValue(
      LIVE.timeLimitMinutes
    )
    await expect(page.getByTestId('escape-room-hint-penalty')).toHaveValue(
      LIVE.hintPenaltySeconds
    )
    await expect(page.getByTestId('escape-room-intro-text')).toHaveValue(
      LIVE.introText
    )
    await page.getByTestId('close-block-countdown').click()
  })

  test('LiveQuiz participant progression, cockpit monitoring, reset, and reload stay synchronized', async ({
    browser,
    page: testPage,
  }, testInfo) => {
    const page = testPage
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('activities').click()
    await page.getByTestId('activities-search-input').fill(LIVE.name)
    await page.getByTestId('activities-search-input').press('Enter')
    await page.getByTestId(`start-live-quiz-${LIVE.name}`).click()
    await expect(page.getByTestId('next-block-timeline')).toBeVisible({
      timeout: 30_000,
    })
    await page.getByTestId('next-block-timeline').click()

    const student = await createStudentPage(browser)
    try {
      await loginStudentPassword(student, {
        username: env('STUDENT_USERNAME'),
      })
      await openStudentLiveQuiz(student, LIVE.displayName)
      await acceptGamifiedLiveQuizAccountPrompt(student, LIVE.displayName)
      await expect(student.getByTestId('escape-room-start')).toBeVisible()
      await expect(student.getByText(SC1.content)).not.toBeAttached()

      await student.getByTestId('escape-room-start').click()
      await expect(student.getByText(SC1.content).first()).toBeVisible()
      await student.setViewportSize({ width: 390, height: 844 })
      await captureEvidence(student, 'live-participant-en-mobile.png')

      await student.getByTestId('sc-0-answer-option-1').click()
      const incorrectResponsePromise = student.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === '/AddResponse'
      )
      await student.getByTestId('student-submit-answer').click()
      const incorrectResponse = await incorrectResponsePromise
      expect(incorrectResponse.status()).toBe(200)
      expect(await incorrectResponse.json()).toMatchObject({
        status: 'incorrect',
      })
      await expect(
        student.getByText(messages.pwa.practiceQuiz.escapeRoomIncorrectToast)
      ).toBeVisible()
      await expect(
        student.getByText(/Locked out\. You can try again in \d+s\./)
      ).toBeVisible()

      await student.reload()
      await expect(student.getByText(SC1.content).first()).toBeVisible()
      const lockoutCountdown = student.getByText(
        /Locked out\. You can try again in \d+s\./
      )
      await expect(lockoutCountdown).toBeVisible()
      await expect(lockoutCountdown).toBeHidden({ timeout: 15_000 })

      await student.getByTestId('sc-0-answer-option-0').click()
      await student.getByTestId('student-submit-answer').click()
      await expect(
        student
          .getByText(messages.pwa.practiceQuiz.escapeRoomCompletedTitle)
          .first()
      ).toBeVisible({ timeout: 30_000 })

      const attemptRow = page
        .locator('[data-cy^="escape-room-attempt-"]')
        .filter({ hasText: env('STUDENT_USERNAME') })
        .first()
      await expect(attemptRow).toContainText(
        messages.manage.evaluation.escapeRoomStatusCompleted,
        { timeout: 30_000 }
      )
      await setLocale(page, 'de')
      const germanAttemptRow = page
        .locator('[data-cy^="escape-room-attempt-"]')
        .filter({ hasText: env('STUDENT_USERNAME') })
        .first()
      await expect(germanAttemptRow).toContainText(
        deMessages.manage.evaluation.escapeRoomStatusCompleted,
        { timeout: 30_000 }
      )
      await germanAttemptRow.scrollIntoViewIfNeeded()
      await captureEvidence(page, 'live-cockpit-de-desktop.png')

      await germanAttemptRow
        .locator('[data-cy^="escape-room-reset-"]')
        .first()
        .click()
      await germanAttemptRow
        .locator('[data-cy^="escape-room-reset-confirm-"]')
        .click()
      await expect(germanAttemptRow).toContainText(
        deMessages.manage.evaluation.escapeRoomStatusNotStarted
      )
      await expect(
        germanAttemptRow.locator('[data-cy^="escape-room-reset-"]')
      ).not.toBeAttached()

      await student.reload()
      await expect(student.getByTestId('escape-room-start')).toBeVisible()
      await expect(student.getByText(SC1.content)).not.toBeAttached()
    } finally {
      await student.context().close()
    }
  })
}
