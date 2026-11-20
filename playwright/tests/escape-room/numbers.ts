import type { Page } from '@playwright/test'
import { test } from '../../util/fixtures.js'
import {
  createQuestionNR,
  env,
  loginLecturer,
  loginStudent,
  loginStudentPassword,
  runTask,
  typeInto,
} from '../../util/workflow.js'
import { createEscapeRoomPracticeQuiz } from './practice-quiz.js'
import { COURSE, captureEvidence, createStudentPage, expect } from './shared.js'

const NR = {
  title: 'ER Numbers Question',
  content: 'A box holds {{A}} coins. How many coins are in three boxes?',
  mistakeLabel: 'Forgot to triple',
  mistakeFeedback: 'Multiply the amount by three.',
}

const NUMBERS_QUIZ = {
  name: 'Escape Room Numbers Quiz',
  displayName: 'Escape Room Numbers Quiz Display',
  description: 'Escape room per-attempt numbers e2e test quiz',
  introText: 'Every player counts their own coins.',
}

// Opens the numbers quiz, starts the attempt and returns the drawn amount.
async function startAndReadAmount(page: Page) {
  await page.getByTestId('quizzes').click()
  await page.getByTestId(`practice-quiz-${NUMBERS_QUIZ.displayName}`).click()
  await page.getByTestId('escape-room-start').click()
  await page.getByTestId('start-practice-quiz').click()
  const content = page.getByText(/A box holds .* coins/).first()
  await expect(content).toBeVisible()
  const match = (await content.textContent())?.match(/holds ([\d']+) coins/)
  expect(match, 'the amount is rendered into the question').toBeTruthy()
  return Number(match![1]!.replaceAll("'", ''))
}

async function answer(page: Page, value: number) {
  await page.getByTestId('input-numerical-0').clear()
  await typeInto(page.getByTestId('input-numerical-0'), String(value))
  await expect(page.getByTestId('student-stack-submit')).toBeEnabled({
    timeout: 15_000,
  })
  await page.getByTestId('student-stack-submit').click()
}

// A numerical stage with a formula solution: each student gets their own
// amount, a typical mistake shows its feedback, and the debrief counts it.
export function registerEscapeRoomNumbersTests() {
  test('Create and publish an escape room with per-attempt numbers', async ({
    page: testPage,
  }, testInfo) => {
    const page = testPage
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await createQuestionNR(page, {
      name: NR.title,
      content: NR.content,
      userId: env('LECTURER_ID'),
      parametrization: {
        variables: [{ name: 'A', kind: 'INTEGER', min: 1000, max: 99999 }],
        solution: { formula: '3 * A', tolerance: 0 },
      },
      mistakes: [
        {
          key: 'once',
          label: NR.mistakeLabel,
          feedback: NR.mistakeFeedback,
          formula: 'A',
          tolerance: 0,
        },
      ],
    })
    await page.getByTestId('library').click()
    await createEscapeRoomPracticeQuiz(page, {
      name: NUMBERS_QUIZ.name,
      displayName: NUMBERS_QUIZ.displayName,
      description: NUMBERS_QUIZ.description,
      courseName: COURSE,
      stacks: [{ elements: [NR.title] }],
      timeLimitMinutes: '30',
      hintPenaltySeconds: '30',
      introText: NUMBERS_QUIZ.introText,
      hints: [],
    })
    await page.getByTestId('open-activity-overview').click()
    await page.waitForURL(/\/courses\/.*tab=practiceQuizzes/)
    await page
      .getByTestId(`publish-practice-quiz-${NUMBERS_QUIZ.name}`)
      .click({ timeout: 60_000 })
    await page.getByTestId('publish-practice-quiz-immediately').click()
    await expect(
      page.getByTestId(`status-${NUMBERS_QUIZ.name}-PUBLISHED`)
    ).toBeAttached()
  })

  test('Two students get their own numbers and a typical mistake shows its feedback', async ({
    page: testPage,
    browser,
  }, testInfo) => {
    const page = testPage
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginStudent(page)
    const amount = await startAndReadAmount(page)

    // the amount alone is the typical mistake of forgetting to triple it
    await answer(page, amount)
    const feedback = page.getByTestId('escape-room-mistake-feedback')
    await expect(feedback).toContainText(NR.mistakeLabel)
    await expect(feedback).toContainText(NR.mistakeFeedback)
    await captureEvidence(page, 'numbers-mistake-en-desktop.png')
    await page.getByTestId('student-stack-continue').click()

    // a reload keeps the student's own numbers
    await page.reload()
    await page.getByTestId('start-practice-quiz').click()
    await expect(page.getByText(/A box holds .* coins/).first()).toContainText(
      String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, "'")
    )

    await answer(page, amount * 3)
    await page.getByTestId('student-stack-continue').click()
    await expect(page.getByTestId('escape-room-completed')).toBeVisible()

    const other = await createStudentPage(browser)
    try {
      await loginStudentPassword(other, {
        username: env('STUDENT_USERNAME2'),
      })
      const otherAmount = await startAndReadAmount(other)
      expect(otherAmount).not.toBe(amount)
      await captureEvidence(other, 'numbers-second-student-en-desktop.png')
    } finally {
      await other.context().close()
    }
  })

  test('Lecturer sees the typical mistake counted in the stage results', async ({
    page: testPage,
  }, testInfo) => {
    const page = testPage
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    const quiz = (await runTask('getPracticeQuizInfo', {
      quizName: NUMBERS_QUIZ.name,
    })) as { id: string } | null
    if (quiz === null) {
      throw new Error('Practice quiz not found')
    }
    await page.goto(`${env('URL_MANAGE')}/practiceQuiz/${quiz.id}/evaluation`, {
      waitUntil: 'commit',
    })
    await page.getByTestId('evaluation-escape-room').click({ timeout: 60_000 })
    await expect(
      page.getByTestId('escape-room-stage-mistakes-1')
    ).toContainText(`${NR.mistakeLabel}: 1`, { timeout: 60_000 })
    await captureEvidence(page, 'numbers-dashboard-en-desktop.png')
  })
}
