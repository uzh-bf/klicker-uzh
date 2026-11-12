import { test } from '../../util/fixtures.js'
import {
  createQuestionSC,
  env,
  loginLecturer,
  loginStudent,
  runTask,
} from '../../util/workflow.js'
import { createEscapeRoomPracticeQuiz } from './practice-quiz.js'
import {
  COURSE,
  SC1,
  SC2,
  captureEvidence,
  expect,
  messages,
} from './shared.js'

const SC3 = {
  title: 'ER SC Question 3',
  content: 'ER SC Content 3',
  choices: [{ value: 'vault', correct: true }, { value: 'door' }],
}

const RULES_QUIZ = {
  name: 'Escape Room Rules Quiz',
  displayName: 'Escape Room Rules Quiz Display',
  description: 'Escape room scoring rules e2e test quiz',
  introText: 'Every shortcut costs ranked time.',
  hints: ['Look at the percentages.', 'It is the smaller one.'],
}

// Classroom preset with two tries before the solution is revealed: stage one
// is revealed after hints and two wrong answers, stage two is skipped, and
// stage three is the bonus question offered after completion.
export function registerEscapeRoomRulesTests() {
  test('Create and publish an escape room practice quiz with the classroom preset', async ({
    page: testPage,
  }, testInfo) => {
    const page = testPage
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await createQuestionSC(page, {
      name: SC3.title,
      content: SC3.content,
      choices: SC3.choices,
      userId: env('LECTURER_ID'),
    })
    await page.getByTestId('library').click()
    await createEscapeRoomPracticeQuiz(page, {
      name: RULES_QUIZ.name,
      displayName: RULES_QUIZ.displayName,
      description: RULES_QUIZ.description,
      courseName: COURSE,
      stacks: [
        { elements: [SC1.title] },
        { elements: [SC2.title] },
        { elements: [SC3.title] },
      ],
      timeLimitMinutes: '45',
      hintPenaltySeconds: '120',
      introText: RULES_QUIZ.introText,
      hints: [{ stackIx: 0, elementIx: 0, text: RULES_QUIZ.hints.join('\n') }],
      applyPreset: true,
      ruleOverrides: { 'escape-room-max-wrong-attempts': '2' },
    })
    await page.getByTestId('open-activity-overview').click()
    await page.waitForURL(/\/courses\/.*tab=practiceQuizzes/)
    await page
      .getByTestId(`publish-practice-quiz-${RULES_QUIZ.name}`)
      .click({ timeout: 60_000 })
    await page.getByTestId('publish-practice-quiz-immediately').click()
    await expect(
      page.getByTestId(`status-${RULES_QUIZ.name}-PUBLISHED`)
    ).toBeAttached()
  })

  test('Student reveals hints in order, gets a stage revealed, skips one and answers the bonus', async ({
    page: testPage,
  }, testInfo) => {
    const page = testPage
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await page.getByTestId('quizzes').click()
    await page.getByTestId(`practice-quiz-${RULES_QUIZ.displayName}`).click()
    await page.getByTestId('escape-room-start').click()
    // the bonus stage is not a required stage
    await expect(page.getByTestId('escape-room-progress-chip')).toHaveText(
      /0\s*\/\s*2/
    )
    await page.getByTestId('start-practice-quiz').click()
    await expect(page.getByText(SC1.content).first()).toBeVisible()
    await expect(page.getByTestId('escape-room-tries-left')).toContainText('2')

    // hints are revealed in order, each priced by its position
    await page.locator('[data-cy^="request-escape-room-hint-"]').first().click()
    await expect(
      page.locator('[data-cy^="escape-room-hint-text-"]').first()
    ).toContainText(RULES_QUIZ.hints[0]!)
    const nextHint = page.getByTestId('escape-room-next-hint')
    await expect(nextHint).toHaveAttribute('data-seconds', '240')
    await nextHint.click()
    await expect(
      page.locator('[data-cy^="escape-room-hint-text-"]')
    ).toHaveCount(2)
    await expect(nextHint).not.toBeAttached()
    await captureEvidence(page, 'rules-hints-tries-en-desktop.png')

    // the first wrong answer costs a try; the second reveals the stage
    await page.getByTestId('sc-0-answer-option-1').click()
    await page.getByTestId('student-stack-submit').click()
    await page.getByTestId('student-stack-continue').click()
    // the lockout window shows a countdown while the wrong answer is retried
    await page.getByTestId('sc-0-answer-option-1').click()
    await expect(
      page.getByTestId('escape-room-lockout-countdown')
    ).toBeVisible()
    await expect(page.getByTestId('escape-room-tries-left')).toBeVisible()
    await expect(page.getByTestId('student-stack-submit')).toBeEnabled({
      timeout: 15_000,
    })
    await page.getByTestId('student-stack-submit').click()
    await expect(page.getByTestId('escape-room-revealed-notice')).toBeVisible()
    await captureEvidence(page, 'rules-revealed-en-desktop.png')
    await page.getByTestId('student-stack-continue').click()

    // skipping clears the second stage and completes the attempt
    await expect(page.getByText(SC2.content).first()).toBeVisible()
    await page.getByTestId('escape-room-skip').click()
    await page.getByTestId('escape-room-skip-confirm').click()
    // a revealed and a skipped stage make the ending an assisted one
    await expect(page.getByTestId('escape-room-completed')).toHaveAttribute(
      'data-outcome',
      'assisted'
    )
    await expect(page.getByTestId('escape-room-exit')).toBeVisible()
    await expect(page.getByTestId('escape-room-ranked-time')).toHaveAttribute(
      'data-seconds',
      /^[1-9]\d*$/
    )

    await captureEvidence(page, 'rules-bonus-offer-en-desktop.png')

    // the bonus question is offered once after completion
    await page.getByTestId('escape-room-bonus').click()
    await expect(page.getByText(SC3.content).first()).toBeVisible()
    await expect(page.getByTestId('escape-room-skip')).not.toBeAttached()
    await page.getByTestId('sc-0-answer-option-0').click()
    await page.getByTestId('student-stack-submit').click()
    await page.getByTestId('student-stack-continue').click()
    await expect(page.getByTestId('escape-room-bonus-result')).toHaveAttribute(
      'data-outcome',
      'BONUS_CORRECT'
    )
    await expect(page.getByTestId('escape-room-bonus')).not.toBeAttached()
  })

  test('Lecturer sees the ranked attempt with its outcomes', async ({
    page: testPage,
  }, testInfo) => {
    const page = testPage
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    const quiz = (await runTask('getPracticeQuizInfo', {
      quizName: RULES_QUIZ.name,
    })) as { id: string } | null
    if (quiz === null) {
      throw new Error('Practice quiz not found')
    }
    await page.goto(`${env('URL_MANAGE')}/practiceQuiz/${quiz.id}/evaluation`, {
      waitUntil: 'commit',
    })
    await page.getByTestId('evaluation-escape-room').click({ timeout: 60_000 })
    const username = env('STUDENT_USERNAME')
    await expect(page.getByTestId(`escape-room-rank-${username}`)).toHaveText(
      '1',
      { timeout: 60_000 }
    )
    const summary = page.getByTestId('escape-room-progress-summary')
    await expect
      .poll(async () => Number(await summary.getAttribute('data-finished')))
      .toBeGreaterThanOrEqual(1)
    const row = page.getByTestId(`escape-room-attempt-${username}`)
    await expect(row).toContainText(
      messages.manage.evaluation.escapeRoomOutcomeSummary
        .replace('{revealed}', '1')
        .replace('{skipped}', '1')
    )
    await expect(row).toContainText(
      messages.manage.evaluation.escapeRoomBonusSolved
    )
    await captureEvidence(page, 'rules-dashboard-en-desktop.png')
  })
}
