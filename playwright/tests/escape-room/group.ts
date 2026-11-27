import type { Page } from '@playwright/test'
import { test } from '../../util/fixtures.js'
import { setDatetime } from '../../util/fixtures/activities.js'
import { getDatetimeValidationString } from '../../util/helpers.js'
import {
  createStacks,
  env,
  loginLecturer,
  loginStudentPassword,
  selectOption,
} from '../../util/workflow.js'
import {
  COURSE,
  CT1,
  GROUP,
  SC1,
  SC2,
  captureEvidence,
  createStudentPage,
  deMessages,
  expect,
  messages,
  setLocale,
} from './shared.js'

// Group-activity wizard flow with the shared escape-room settings enabled on
// the settings step. Each answerable element of the single stack is one
// ordered stage that the team unlocks and clears in turn.
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
      monthDelta: -2,
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
      monthDelta: 1,
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

  // Content is intentionally mixed with the answerable stages. The PWA must
  // render it but never submit its read marker as a stage response.
  await createStacks(page, {
    stacks: [{ elements: [CT1.title, SC1.title, SC2.title] }],
  })
  await page.getByTestId('next-or-submit').click()
}

export function registerGroupEscapeRoomTests() {
  test('Create and publish an escape room group activity', async ({
    page: testPage,
  }, testInfo) => {
    const page = testPage
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

  test('Two group members share one attempt while the lecturer monitors and resets it', async ({
    browser,
    page: testPage,
  }, testInfo) => {
    const page = testPage
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${COURSE}`).click()
    await page.getByTestId('tab-groupActivities').click()
    await page.getByTestId(`actions-GROUP_ACTIVITY-${GROUP.name}`).click()
    await page.getByTestId(`monitor-group-activity-${GROUP.name}`).click()

    const member1 = await createStudentPage(browser)
    const member2 = await createStudentPage(browser)
    try {
      await loginStudentPassword(member1, {
        username: env('STUDENT_USERNAME'),
      })
      await member1.getByTestId(`course-button-${COURSE}`).click()
      await member1.waitForURL(/\/course\//)
      await member1.reload()
      await member1.getByTestId('student-course-existing-group-0').click()
      await member1
        .getByTestId(`open-group-activity-${GROUP.displayName}`)
        .click()
      await member1.getByTestId('start-group-activity').click()
      await expect(member1.getByTestId('escape-room-start')).toBeVisible()

      await loginStudentPassword(member2, {
        username: env('STUDENT_USERNAME15'),
      })
      await member2.getByTestId(`course-button-${COURSE}`).click()
      await member2.waitForURL(/\/course\//)
      await member2.reload()
      await member2.setViewportSize({ width: 390, height: 844 })
      await setLocale(member2, 'de')
      await member2.getByTestId('student-course-existing-group-0').click()
      await member2
        .getByTestId(`open-group-activity-${GROUP.displayName}`)
        .click()
      await expect(member2.getByTestId('escape-room-start')).toBeVisible()

      await Promise.all([
        member1.getByTestId('escape-room-start').click(),
        member2.getByTestId('escape-room-start').click(),
      ])
      await expect(member1.getByText(SC1.content).first()).toBeVisible()
      await expect(member2.getByText(SC1.content).first()).toBeVisible()
      // later stages stay hidden until the team clears the current one
      await expect(member1.getByText(SC2.content)).not.toBeAttached()
      await expect(member2.getByText(SC2.content)).not.toBeAttached()
      await expect(page.getByTestId('group-escape-room-progress')).toBeVisible({
        timeout: 20_000,
      })

      const attemptRow = page
        .locator('[data-cy^="escape-room-attempt-"]')
        .first()
      await expect(attemptRow).toContainText(
        messages.manage.evaluation.escapeRoomStatusInProgress,
        { timeout: 20_000 }
      )
      await captureEvidence(page, 'group-dashboard-en-desktop.png')

      await member1.getByTestId('sc-1-answer-option-1').click()
      await member1.getByTestId('submit-group-activity').click()
      await expect(
        member1.getByText(messages.pwa.practiceQuiz.escapeRoomLockoutToast)
      ).toBeVisible()

      // The second member hits the same server-owned group lockout.
      await member2.getByTestId('sc-1-answer-option-1').click()
      await member2.getByTestId('submit-group-activity').click()
      await expect(
        member2.getByText(deMessages.pwa.practiceQuiz.escapeRoomLockoutToast)
      ).toBeVisible()
      await captureEvidence(member2, 'group-participant-de-mobile.png')

      await expect(member1.getByTestId('submit-group-activity')).toBeEnabled({
        timeout: 15_000,
      })
      await member1.getByTestId('sc-1-answer-option-0').click()
      await member1.getByTestId('submit-group-activity').click()
      await expect(member1.getByText(SC2.content).first()).toBeVisible()
      await expect(
        member1.getByTestId('group-escape-stage-1-cleared')
      ).toBeAttached()

      // The teammate's page picks up the cleared stage by polling, keeps the
      // team's answer read-only, and can answer the next stage.
      await expect(member2.getByText(SC2.content).first()).toBeVisible({
        timeout: 20_000,
      })
      await expect(
        member2.getByTestId('group-escape-stage-1-cleared')
      ).toBeAttached()
      await expect(
        member2.getByTestId('group-escape-stage-2-current')
      ).toBeAttached()
      await member2.getByTestId('sc-2-answer-option-0').click()
      await member2.getByTestId('submit-group-activity').click()
      await expect(
        member2
          .getByText(deMessages.pwa.practiceQuiz.escapeRoomCompletedTitle)
          .first()
      ).toBeVisible()
      await expect(
        member1
          .getByText(messages.pwa.practiceQuiz.escapeRoomCompletedTitle)
          .first()
      ).toBeVisible({ timeout: 20_000 })
      await expect(attemptRow).toContainText(
        messages.manage.evaluation.escapeRoomStatusCompleted,
        { timeout: 20_000 }
      )

      await attemptRow
        .locator('[data-cy^="escape-room-reset-"]')
        .first()
        .click()
      await attemptRow
        .locator('[data-cy^="escape-room-reset-confirm-"]')
        .click()
      await expect(attemptRow).toContainText(
        messages.manage.evaluation.escapeRoomStatusNotStarted
      )
      await expect(
        attemptRow.locator('[data-cy^="escape-room-reset-"]')
      ).not.toBeAttached()

      await Promise.all([member1.reload(), member2.reload()])
      await expect(member1.getByTestId('start-group-activity')).toBeVisible()
      await expect(member2.getByTestId('start-group-activity')).toBeVisible()
    } finally {
      await member1.context().close()
      await member2.context().close()
    }
  })
}
