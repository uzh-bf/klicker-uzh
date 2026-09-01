import type { Page } from '@playwright/test'
import { test } from '../../util/fixtures.js'
import { setDatetime } from '../../util/fixtures/activities.js'
import { getDatetimeValidationString } from '../../util/helpers.js'
import {
  createStacks,
  loginLecturer,
  loginStudent,
  selectOption,
} from '../../util/workflow.js'
import { COURSE, MICRO, SC1, SC2, expect, messages } from './shared.js'

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

export function registerMicrolearningCreationTest() {
  test('Create and publish an escape room microlearning', async ({
    page: testPage,
  }, testInfo) => {
    const page = testPage
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
}

export function registerMicrolearningFlowTest() {
  test('Microlearning wrong answer, lockout, retry, reload, and completion stay in the escape flow', async ({
    page: testPage,
  }, testInfo) => {
    const page = testPage
    testInfo.setTimeout(600_000)
    await loginStudent(page)
    // the microlearning tile lives on the student home page (not the practice
    // quiz repetition page reached via the "quizzes" link)
    await page.getByTestId(`microlearning-${MICRO.displayName}`).click()
    await page.waitForURL(/\/microLearnings\//)
    await page.reload()
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

    // the authoritative refetch advances the stale URL to the next uncleared
    // stack, so the evaluation's continue button can be only transient
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
}
