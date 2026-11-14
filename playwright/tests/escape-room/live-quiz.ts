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
  SC2,
  captureEvidence,
  createStudentPage,
  deMessages,
  expect,
  messages,
  setLocale,
} from './shared.js'
import { SC3 } from './rules.js'

const LIVE_RULES = {
  name: 'Escape Room Live Rules Quiz',
  displayName: 'Escape Room Live Rules Quiz Display',
}

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
      await acceptGamifiedLiveQuizAccountPrompt(
        student,
        LIVE.displayName,
        'escape-room-start'
      )
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
        student.getByTestId('escape-room-lockout-countdown')
      ).toBeVisible()

      await student.reload()
      await expect(student.getByText(SC1.content).first()).toBeVisible()
      const lockoutCountdown = student.getByTestId(
        'escape-room-lockout-countdown'
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

  test('LiveQuiz block with the classroom preset: wrong answer, reveal, skip, bonus and ranking', async ({
    browser,
    page: testPage,
  }, testInfo) => {
    const page = testPage
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)

    // --- author: one block of three questions; the last one becomes the
    // bonus stage through the classroom preset, with two tries per stage ---
    await page.getByTestId('create-live-quiz').click()
    await page.getByTestId('insert-live-quiz-name').fill(LIVE_RULES.name)
    await page.getByTestId('next-or-submit').click()
    await page
      .getByTestId('insert-live-display-name')
      .fill(LIVE_RULES.displayName)
    await page.getByTestId('insert-live-description').click()
    await page
      .getByTestId('insert-live-description')
      .pressSequentially(LIVE.description)
    await page.getByTestId('next-or-submit').click()
    await selectOption(page, '[data-cy="select-course"]', COURSE)
    await expect(page.getByTestId('select-course')).toContainText(COURSE)
    await page.getByTestId('next-or-submit').click()
    await createStacks(page, {
      stacks: [{ elements: [SC1.title, SC2.title, SC3.title] }],
      type: 'block',
    })
    await page.getByTestId('open-block-0-countdown').click()
    await page.getByTestId('toggle-escape-room').click()
    await expect(page.getByTestId('escape-room-time-limit')).toBeVisible()
    await page.getByTestId('escape-room-apply-preset').click()
    await page.getByTestId('escape-room-max-wrong-attempts').fill('2')
    await page.getByTestId('escape-room-time-limit').fill('45')
    await page.getByTestId('close-block-countdown').click()
    // the debrief shows on the projector once the block is closed
    await page
      .locator('[data-cy^="escape-room-debrief-block-"]')
      .first()
      .fill('Debrief for the first stage')
    await page.getByTestId('next-or-submit').click()
    await page.waitForTimeout(500)

    // --- run the quiz and open the block ---
    await page.getByTestId('activities').click()
    await page.getByTestId('activities-search-input').fill(LIVE_RULES.name)
    await page.getByTestId('activities-search-input').press('Enter')
    await page.getByTestId(`start-live-quiz-${LIVE_RULES.name}`).click()
    await expect(page.getByTestId('next-block-timeline')).toBeVisible({
      timeout: 30_000,
    })
    await page.getByTestId('next-block-timeline').click()

    const student = await createStudentPage(browser)
    try {
      await loginStudentPassword(student, {
        username: env('STUDENT_USERNAME'),
      })
      await openStudentLiveQuiz(student, LIVE_RULES.displayName)
      await acceptGamifiedLiveQuizAccountPrompt(
        student,
        LIVE_RULES.displayName,
        'escape-room-start'
      )
      await student.getByTestId('escape-room-start').click()
      await expect(student.getByText(SC1.content).first()).toBeVisible()
      await expect(student.getByTestId('escape-room-tries-left')).toBeVisible()

      // first wrong answer: one try is left
      await student.getByTestId('sc-0-answer-option-1').click()
      await student.getByTestId('student-submit-answer').click()
      await expect(
        student.getByTestId('escape-room-incorrect-notice')
      ).toBeVisible()
      await expect(student.getByTestId('escape-room-tries-left')).toBeVisible()
      await expect(
        student.getByTestId('escape-room-lockout-countdown')
      ).toBeHidden({ timeout: 30_000 })

      // second wrong answer: the solution is revealed instead of a lockout
      await student.getByTestId('sc-0-answer-option-1').click()
      await student.getByTestId('student-submit-answer').click()
      await expect(
        student.getByTestId('escape-room-revealed-notice')
      ).toBeVisible()
      await expect(
        student.getByTestId('escape-room-revealed-solution')
      ).toContainText(SC1.choices[0]!.value)
      await student.getByTestId('escape-room-revealed-continue').click()

      // skip the second stage after confirming; the bonus stage is not a
      // regular stage, so this completes the attempt
      await expect(student.getByText(SC2.content).first()).toBeVisible()
      await student.getByTestId('escape-room-skip').click()
      await student.getByTestId('escape-room-skip-confirm').click()
      await expect(
        student.getByTestId('escape-room-completed')
      ).toHaveAttribute('data-outcome', 'assisted', { timeout: 30_000 })

      // the bonus question is offered once and answered correctly
      await student.getByTestId('escape-room-bonus').click()
      await expect(student.getByText(SC3.content).first()).toBeVisible()
      await expect(student.getByTestId('escape-room-skip')).not.toBeAttached()
      await student.getByTestId('sc-0-answer-option-0').click()
      await student.getByTestId('student-submit-answer').click()
      await expect(
        student.getByTestId('escape-room-bonus-result')
      ).toHaveAttribute('data-outcome', 'BONUS_CORRECT', { timeout: 30_000 })

      // the cockpit ranks the attempt and lists the outcomes
      const attemptRow = page
        .locator('[data-cy^="escape-room-attempt-"]')
        .filter({ hasText: env('STUDENT_USERNAME') })
        .first()
      await expect(attemptRow).toContainText(
        messages.manage.evaluation.escapeRoomStatusCompleted,
        { timeout: 30_000 }
      )
      await expect(
        page.locator(`[data-cy="escape-room-rank-${env('STUDENT_USERNAME')}"]`)
      ).toHaveText('1', { timeout: 30_000 })

      // the projector opens in a new tab and ranks the running block
      const [projector] = await Promise.all([
        page.waitForEvent('popup'),
        page.getByTestId('escape-room-open-projector').click(),
      ])
      await expect(projector.getByTestId('escape-projector')).toHaveAttribute(
        'data-phase',
        'RUNNING',
        { timeout: 30_000 }
      )
      await expect(
        projector.getByTestId('escape-projector-ranking')
      ).toBeVisible()
      await expect(
        projector.getByTestId('escape-projector-row').first()
      ).toBeVisible()
      await expect(
        projector.getByTestId('escape-projector-debrief')
      ).not.toBeAttached()

      // closing the block switches the projector to the closed state, which
      // carries the debrief
      await page.getByTestId('next-block-timeline').click()
      await expect(projector.getByTestId('escape-projector')).toHaveAttribute(
        'data-phase',
        'CLOSED',
        { timeout: 30_000 }
      )
      await expect(
        projector.getByTestId('escape-projector-debrief').first()
      ).toBeVisible()
      await projector.close()

      // the evaluation page keeps the table of the executed block
      const evaluationLink = page
        .getByTestId('evaluation-results-cockpit')
        .locator('xpath=ancestor::a[1]')
      const href = await evaluationLink.getAttribute('href')
      if (!href || !href.includes('/evaluation')) {
        throw new Error(`Unexpected evaluation link: ${href}`)
      }
      await page.goto(
        href.startsWith('http') ? href : `${env('URL_MANAGE')}${href}`
      )
      await page.getByTestId('evaluation-escape-room').click()
      await expect(page.getByTestId('escape-room-progress-table')).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.getByTestId('escape-room-stage-table')).toBeVisible()
    } finally {
      await student.context().close()
    }
  })
}
