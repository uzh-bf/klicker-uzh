/**
 * Escape room end-to-end workflow.
 * Covers the full feature chain: lecturer authors an escape-room practice
 * quiz through the wizard (settings, intro story, per-element hint), the
 * settings prefill on edit, a participant plays the sequential game loop
 * (server-side stack masking, hint reveal with time penalty, wrong-answer
 * lockout, completion stats), and the lecturer dashboard shows and resets
 * the attempt.
 */
import { expect, type Page } from '@playwright/test'
import { test } from '../util/fixtures.js'
import { setDatetime, type StackType } from '../util/fixtures/activities.js'
import { getDatetimeValidationString } from '../util/helpers.js'
import { enMessages as messages } from '../util/messages.js'
import {
  createContent,
  createQuestionSC,
  createStacks,
  env,
  loginLecturer,
  loginStudent,
  runTask,
  selectOption,
} from '../util/workflow.js'

let page: Page

function timerSeconds(value: string) {
  const [minutes, seconds] = value.split(':').map(Number)
  return minutes! * 60 + seconds!
}

const COURSE = 'Testkurs'

const QUIZ = {
  name: 'Escape Room Quiz',
  displayName: 'Escape Room Quiz Display',
  description: 'Escape room e2e test quiz',
  introText: 'The vault is sealed. Solve every stage to escape before',
  timeLimitMinutes: '30',
  hintPenaltySeconds: '30',
  hint: 'The answer is the first option.',
}
const MICRO = {
  name: 'Escape Room Microlearning',
  displayName: 'Escape Room Microlearning Display',
}

const SC1 = {
  title: 'ER SC Question 1',
  content: 'ER SC Content 1',
  choices: [{ value: '25%', correct: true }, { value: '50%' }],
}
const SC2 = {
  title: 'ER SC Question 2',
  content: 'ER SC Content 2',
  choices: [{ value: '100%', correct: true }, { value: '0%' }],
}
const CT1 = {
  title: 'ER Content 1',
  content: 'ER Content Element 1',
}

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

async function createEscapeRoomMicroLearning(page: Page) {
  await page.getByTestId('create-microlearning').click()
  await page.getByTestId('insert-microlearning-name').fill(MICRO.name)
  await page.getByTestId('next-or-submit').click()
  await page
    .getByTestId('insert-microlearning-display-name')
    .fill(MICRO.displayName)
  await page.getByTestId('next-or-submit').click()

  await selectOption(page, '[data-cy="select-course"]', COURSE)
  await setDatetime(page, {
    cyString: 'select-start-date',
    deselectorString: 'availability-section-header',
    datetime: {
      monthDelta: -1,
      day: 10,
      hour: 8,
      minute: 0,
      validation: `${getDatetimeValidationString(-1, '10')}, 08:00`,
    },
  })
  await setDatetime(page, {
    cyString: 'select-end-date',
    deselectorString: 'availability-section-header',
    datetime: {
      monthDelta: 2,
      day: 10,
      hour: 18,
      minute: 0,
      validation: `${getDatetimeValidationString(2, '10')}, 18:00`,
    },
  })
  await page.getByTestId('toggle-escape-room').click()
  await page.getByTestId('escape-room-time-limit').fill('30')
  await page.getByTestId('escape-room-hint-penalty').fill('30')
  await page.getByTestId('next-or-submit').click()
  await createStacks(page, {
    stacks: [{ elements: [SC1.title] }, { elements: [SC2.title] }],
  })
  await page.getByTestId('next-or-submit').click()
}

test.describe.serial('Escape room workflows', () => {
  test('CLEANUP', async ({ page: testPage }, testInfo) => {
    page = testPage
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await runTask('cleanupDatabase')
    await runTask('seedDatabase')
  })

  test('Create the questions required for the escape room', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await createQuestionSC(page, {
      name: SC1.title,
      content: SC1.content,
      choices: SC1.choices,
      userId: env('LECTURER_ID'),
    })
    await createQuestionSC(page, {
      name: SC2.title,
      content: SC2.content,
      choices: SC2.choices,
      userId: env('LECTURER_ID'),
    })
    await createContent(page, {
      name: CT1.title,
      content: CT1.content,
      userId: env('LECTURER_ID'),
    })
  })

  test('Create an escape room practice quiz with settings, intro story, and a hint', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
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
    await page.getByTestId('tab-practiceQuizzes').click()
    await expect(
      page.getByTestId(`activity-PRACTICE_QUIZ-${QUIZ.name}`)
    ).toBeAttached()
    await expect(page.getByTestId(`status-${QUIZ.name}-DRAFT`)).toBeAttached()
  })

  test('Verify that the escape room settings prefill when editing the draft', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
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
    page = testPage
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
    page = testPage
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
    page = testPage
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

  test('Wrong answer stays on the stage and a rapid resubmit hits the lockout', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
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
    page = testPage
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    await page.getByTestId('quizzes').click()
    await page.getByTestId(`practice-quiz-${QUIZ.displayName}`).click()
    await page.getByTestId('start-practice-quiz').click()
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
    page = testPage
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
    await page.getByTestId('evaluation-escape-room').click()
    await expect(page.getByTestId('escape-room-progress-table')).toBeVisible()
    const attemptRow = page.locator('[data-cy^="escape-room-attempt-"]').first()
    await expect(attemptRow).toBeVisible()
    await expect(attemptRow).toContainText(
      messages.manage.evaluation.escapeRoomStatusCompleted
    )

    // two-step reset: the confirm button replaces the reset button
    await page
      .locator(
        '[data-cy^="escape-room-reset-"]:not([data-cy^="escape-room-reset-confirm-"])'
      )
      .first()
      .click()
    await page
      .locator('[data-cy^="escape-room-reset-confirm-"]')
      .first()
      .click()
    await expect(
      page.locator('[data-cy^="escape-room-attempt-"]')
    ).not.toBeAttached()
    await expect(
      page.getByText(messages.manage.evaluation.escapeRoomNoAttempts).first()
    ).toBeVisible()
  })

  test('Student can start a fresh attempt after the reset', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
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

  test('Create and publish an escape room microlearning', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    testInfo.setTimeout(600_000)
    await loginLecturer(page)
    await page.getByTestId('library').click()
    await createEscapeRoomMicroLearning(page)
    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-microLearnings').click()
    await page.getByTestId(`publish-microlearning-${MICRO.name}`).click()
    await page.getByTestId('confirm-publish-action').click()
    await expect(
      page.getByTestId(`status-${MICRO.name}-PUBLISHED`)
    ).toBeAttached()
  })

  test('Microlearning wrong answer, lockout, retry, reload, and completion stay in the escape flow', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    testInfo.setTimeout(600_000)
    await loginStudent(page)
    await page.getByTestId('quizzes').click()
    await page.getByTestId(`microlearning-${MICRO.displayName}`).click()
    await page.getByTestId('start-microlearning').click()
    await page.getByTestId('escape-room-start').click()

    await expect(page.getByText(SC1.content).first()).toBeVisible()
    await page.getByTestId('sc-0-answer-option-1').click()
    await page.getByTestId('student-stack-submit').click()
    await page.getByTestId('student-stack-continue').click()
    await expect(page).toHaveURL(/\/microLearnings\/[^/]+\/0$/)
    await page.reload()
    await expect(page.getByText(SC1.content).first()).toBeVisible()

    await page.getByTestId('sc-0-answer-option-1').click()
    await page.getByTestId('student-stack-submit').click()
    await expect(
      page.getByTestId('escape-room-lockout-countdown')
    ).toBeVisible()
    await expect(page.getByTestId('student-stack-submit')).toBeEnabled({
      timeout: 15_000,
    })
    await page.getByTestId('sc-0-answer-option-0').click()
    await page.getByTestId('student-stack-submit').click()
    await page.getByTestId('student-stack-continue').click()
    await expect(page).toHaveURL(/\/microLearnings\/[^/]+\/1$/)
    await expect(page.getByText(SC2.content).first()).toBeVisible()

    await page.reload()
    await expect(page.getByText(SC2.content).first()).toBeVisible()
    await page.getByTestId('sc-0-answer-option-0').click()
    await page.getByTestId('student-stack-submit').click()
    await page.getByTestId('student-stack-continue').click()
    await expect(
      page.getByText(messages.pwa.practiceQuiz.escapeRoomCompletedTitle).first()
    ).toBeVisible()
  })
})
