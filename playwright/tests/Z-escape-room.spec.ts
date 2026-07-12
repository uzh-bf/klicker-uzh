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
  createQuestionQrScan,
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
const QR = {
  title: 'ER QR Scan Question',
  content: 'Scan the hidden vault marker',
  code: 'AbCdEf12_-34',
  quizName: 'Escape Room QR Quiz',
  quizDisplayName: 'Escape Room QR Quiz Display',
}
const GROUP = {
  name: 'Escape Room Group Activity',
  displayName: 'Escape Room Group Activity Display',
  task: 'Crack the vault together before the timer runs out.',
  introText: 'Only teamwork opens the vault. Coordinate and escape.',
  clues: [
    { name: 'Vault Clue Alpha', displayName: 'Clue Alpha', content: 'north' },
    { name: 'Vault Clue Beta', displayName: 'Clue Beta', content: 'south' },
  ],
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

// Group-activity wizard flow with the shared escape-room settings enabled on
// the settings step. Group activities carry a single stack, so the escape
// gate operates on the one all-or-nothing decisions submission.
async function createEscapeRoomGroupActivity(page: Page) {
  await page.getByTestId('create-group-activity').click()

  await page.getByTestId('insert-groupactivity-name').fill(GROUP.name)
  await page.getByTestId('next-or-submit').click()

  await page.getByTestId('back-activity-creation').click()
  await page.getByTestId('next-or-submit').click()
  await page
    .getByTestId('insert-groupactivity-display-name')
    .fill(GROUP.displayName)
  await page.getByTestId('insert-groupactivity-description').click()
  await page
    .getByTestId('insert-groupactivity-description')
    .pressSequentially(GROUP.task)
  await page.getByTestId('next-or-submit').click()

  await selectOption(page, '[data-cy="select-course"]', COURSE)
  await expect(page.getByTestId('select-course')).toContainText(COURSE)
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

  // the escape settings render only once the checkbox is toggled
  await expect(page.getByTestId('escape-room-time-limit')).not.toBeAttached()
  await page.getByTestId('toggle-escape-room').click()
  await expect(page.getByTestId('escape-room-time-limit')).toBeVisible()
  await page.getByTestId('escape-room-time-limit').fill('30')
  await page.getByTestId('escape-room-hint-penalty').fill('30')
  await page.getByTestId('escape-room-intro-text').fill(GROUP.introText)
  await page.getByTestId('next-or-submit').click()

  // group activities require at least two clues
  for (const clue of GROUP.clues) {
    await page.getByTestId('add-group-activity-clue').click()
    await page.getByTestId('group-activity-clue-type').click()
    await page.getByTestId('group-activity-clue-type-string').click()
    await page.getByTestId('group-activity-clue-name').fill(clue.name)
    await page
      .getByTestId('group-activity-clue-display-name')
      .fill(clue.displayName)
    await page
      .getByTestId('group-activity-string-clue-value')
      .fill(clue.content)
    await page.getByTestId('group-activity-clue-save').click()
    await expect(page.getByText(clue.name, { exact: true })).toBeVisible()
  }

  await createStacks(page, { stacks: [{ elements: [SC1.title] }] })
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
    await createQuestionQrScan(page, {
      name: QR.title,
      content: QR.content,
      code: QR.code,
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
    await page.waitForURL(/\/courses\/.*tab=practiceQuizzes/)
    await expect(
      page.getByTestId(`activity-PRACTICE_QUIZ-${QUIZ.name}`)
    ).toBeAttached({ timeout: 60_000 })
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
    page = testPage
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
    page = testPage
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
    await page.waitForURL(/\/courses\/.*tab=microLearnings/)
    await page.getByTestId(`publish-microlearning-${MICRO.name}`).click()
    await page.getByTestId('confirm-publish-action').click()
    await expect(
      page.getByTestId(`status-${MICRO.name}-PUBLISHED`)
    ).toBeAttached()
  })

  test('QR scanner denial falls back to a validated manual code', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
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
      messages.shared.QR_SCAN.cameraFallback
    )
    const manualCode = page.getByLabel(messages.shared.QR_SCAN.manualLabel)
    await manualCode.fill('not-a-code')
    await expect(page.getByTestId('student-stack-submit')).toBeDisabled()
    await manualCode.fill(QR.code)
    await expect(page.getByTestId('student-stack-submit')).toBeEnabled()
    await page.getByTestId('student-stack-submit').click()
    await expect(
      page.getByText(messages.pwa.practiceQuiz.escapeRoomCompletedTitle).first()
    ).toBeVisible()
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

    // wrong answer: grading sets a server-side lockout window
    await page.getByTestId('sc-0-answer-option-1').click()
    await page.getByTestId('student-stack-submit').click()
    await page.getByTestId('student-stack-continue').click()

    // the stage remounts for a retry on the same URL instead of advancing
    await expect(page).toHaveURL(/\/microLearnings\/[^/]+\/0$/)
    await expect(page.getByText(SC1.content).first()).toBeVisible()

    // resubmitting within the lockout window surfaces the countdown
    // (clicks must land within ~5s of grading)
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

    // a full reload stays in the escape flow at the current stage
    await page.reload()
    await expect(page.getByText(SC2.content).first()).toBeVisible()
    await page.getByTestId('sc-0-answer-option-0').click()
    await page.getByTestId('student-stack-submit').click()

    // clearing the last stage completes the server-side attempt and the
    // completion overlay takes over without a continue click
    await expect(
      page.getByText(messages.pwa.practiceQuiz.escapeRoomCompletedTitle).first()
    ).toBeVisible()
  })

  test('Create and publish an escape room group activity', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('library').click()
    await createEscapeRoomGroupActivity(page)
    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-groupActivities').click()
    await expect(
      page.getByTestId(`activity-GROUP_ACTIVITY-${GROUP.name}`)
    ).toBeAttached({ timeout: 60_000 })
    await page.getByTestId(`publish-group-activity-${GROUP.name}`).click()
    await page.getByTestId('confirm-publish-action').click()
    // a past start date publishes the activity as immediately available
    await expect(
      page.getByTestId(`status-${GROUP.name}-PUBLISHED`)
    ).toBeAttached()
  })

  test('Group members start, hit the lockout on a wrong answer, and escape on the correct one', async ({
    page: testPage,
  }, testInfo) => {
    page = testPage
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    // testuser1 belongs to a seeded two-member group ("Gruppe 1"), which
    // clears the minimum-size gate for starting a group activity
    await loginStudent(page)
    await page.getByTestId(`course-button-${COURSE}`).click()
    await page.getByTestId('student-course-existing-group-0').click()
    await page.getByTestId(`open-group-activity-${GROUP.displayName}`).click()
    await page.getByTestId('start-group-activity').click()

    // the group instance now exists; the escape overlay withholds the stack
    // until a shared attempt is started
    await page.getByTestId('escape-room-start').click()
    await expect(page.getByText(SC1.content).first()).toBeVisible()

    // a wrong answer in the all-or-nothing submission persists nothing and
    // locks the whole group out for a short window
    await page.getByTestId('sc-0-answer-option-1').click()
    await page.getByTestId('submit-group-activity').click()
    await expect(
      page.getByText(messages.pwa.practiceQuiz.escapeRoomLockoutToast)
    ).toBeVisible()
    await expect(page.getByTestId('submit-group-activity')).toBeEnabled({
      timeout: 15_000,
    })

    // the correct answer clears the single stack and completes the shared
    // attempt, surfacing the completion overlay
    await page.getByTestId('sc-0-answer-option-0').click()
    await page.getByTestId('submit-group-activity').click()
    await expect(
      page.getByText(messages.pwa.practiceQuiz.escapeRoomCompletedTitle).first()
    ).toBeVisible()
  })
})
