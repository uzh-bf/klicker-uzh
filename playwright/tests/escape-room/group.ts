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
  GROUP_SESSION,
  SC1,
  SC2,
  captureEvidence,
  createStudentPage,
  expect,
  messages,
  setLocale,
} from './shared.js'

// Group-activity wizard flow with the shared escape-room settings enabled on
// the settings step. Each answerable element of the single stack is one
// ordered stage that the team unlocks and clears in turn.
async function createEscapeRoomGroupActivity(
  page: Page,
  { activity = GROUP, sessionClock = false } = {}
) {
  await page.getByTestId('create-group-activity').click()

  await page.getByTestId('insert-groupactivity-name').fill(activity.name)
  await page.getByTestId('next-or-submit').click()

  await page.getByTestId('back-activity-creation').click()
  await page.getByTestId('next-or-submit').click()
  await page
    .getByTestId('insert-groupactivity-display-name')
    .fill(activity.displayName)
  await page.getByTestId('insert-groupactivity-description').click()
  await page
    .getByTestId('insert-groupactivity-description')
    .pressSequentially(activity.task)
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
  await page.getByTestId('escape-room-intro-text').fill(activity.introText)
  if (sessionClock) {
    await page.getByTestId('toggle-escape-room-session-clock').click()
  }
  await page.getByTestId('next-or-submit').click()

  // group activities require at least two clues
  for (const clue of activity.clues) {
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
        member1.getByTestId('escape-room-incorrect-notice')
      ).toBeVisible()

      // The second member hits the same server-owned group lockout.
      await member2.getByTestId('sc-1-answer-option-1').click()
      await member2.getByTestId('submit-group-activity').click()
      await expect(
        member2.getByTestId('escape-room-incorrect-notice')
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
      await expect(member2.getByTestId('escape-room-completed')).toBeVisible()
      await expect(member1.getByTestId('escape-room-completed')).toBeVisible({
        timeout: 20_000,
      })
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

// Lecturer-controlled session clock: the lecturer opens the lobby, starts,
// pauses, resumes and ends the session while one group plays, and the
// classroom projector follows along without a login.
export function registerGroupSessionClockTests() {
  test('Create and publish a session clock escape room group activity', async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('library').click()
    await createEscapeRoomGroupActivity(page, {
      activity: GROUP_SESSION,
      sessionClock: true,
    })
    await page.getByTestId('open-activity-overview').click()
    await page.getByTestId('tab-groupActivities').click()
    await expect(
      page.getByTestId(`activity-GROUP_ACTIVITY-${GROUP_SESSION.name}`)
    ).toBeAttached({ timeout: 60_000 })
    await page
      .getByTestId(`publish-group-activity-${GROUP_SESSION.name}`)
      .click()
    await page.getByTestId('confirm-publish-action').click()
    await expect(
      page.getByTestId(`status-${GROUP_SESSION.name}-PUBLISHED`)
    ).toBeAttached()
  })

  test('A lecturer starts, pauses, resumes and ends a session clock escape room while a group plays', async ({
    browser,
    page,
  }, testInfo) => {
    testInfo.setTimeout(600_000)
    page.setDefaultNavigationTimeout(300_000)
    await loginLecturer(page)
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${COURSE}`).click()
    await page.getByTestId('tab-groupActivities').click()
    await page
      .getByTestId(`actions-GROUP_ACTIVITY-${GROUP_SESSION.name}`)
      .click()
    await page
      .getByTestId(`monitor-group-activity-${GROUP_SESSION.name}`)
      .click()

    const controls = page.getByTestId('escape-session-controls')
    await expect(controls).toHaveAttribute('data-phase', 'LOBBY', {
      timeout: 30_000,
    })

    const member = await createStudentPage(browser)
    let classroom: Page | undefined
    try {
      // the group opens the activity and waits in the lobby
      await loginStudentPassword(member, { username: env('STUDENT_USERNAME') })
      await member.getByTestId(`course-button-${COURSE}`).click()
      await member.waitForURL(/\/course\//)
      await member.reload()
      await member.getByTestId('student-course-existing-group-0').click()
      await member
        .getByTestId(`open-group-activity-${GROUP_SESSION.displayName}`)
        .click()
      await member.getByTestId('start-group-activity').click()
      await expect(member.getByTestId('escape-room-start')).toBeDisabled()
      await expect(
        member.getByTestId('escape-room-session-waiting')
      ).toBeVisible()
      await captureEvidence(member, 'group-session-lobby-en-desktop.png')
      await captureEvidence(page, 'group-session-controls-lobby-en-desktop.png')

      // starting the session enables the group's start button without a reload
      await page.getByTestId('escape-session-start').click()
      await expect(controls).toHaveAttribute('data-phase', 'RUNNING')
      await expect(member.getByTestId('escape-room-start')).toBeEnabled({
        timeout: 20_000,
      })
      await member.getByTestId('escape-room-start').click()
      await expect(member.getByText(SC1.content).first()).toBeVisible()
      await member.getByTestId('sc-1-answer-option-0').click()
      await member.getByTestId('submit-group-activity').click()
      await expect(member.getByText(SC2.content).first()).toBeVisible()
      await captureEvidence(member, 'group-session-running-en-desktop.png')

      // the projector opens in a new tab; a fresh context without cookies
      // shows the same running session with the group's row
      const [popup] = await Promise.all([
        page.waitForEvent('popup'),
        page.getByTestId('escape-room-open-projector').click(),
      ])
      const projectorUrl = popup.url()
      await popup.close()
      classroom = await createStudentPage(browser)
      await classroom.goto(projectorUrl)
      const projector = classroom.getByTestId('escape-projector')
      await expect(projector).toHaveAttribute('data-phase', 'RUNNING', {
        timeout: 30_000,
      })
      await expect(projector).toHaveAttribute('data-paused', 'false')
      await expect(
        classroom.getByTestId('escape-projector-row').first()
      ).toBeVisible({ timeout: 30_000 })
      await captureEvidence(
        classroom,
        'group-session-projector-running-en-desktop.png'
      )

      // pausing freezes the group's timer and hides the stage
      await page.getByTestId('escape-session-pause').click()
      await expect(controls).toHaveAttribute('data-phase', 'PAUSED')
      await expect(member.getByTestId('escape-room-paused')).toBeVisible({
        timeout: 20_000,
      })
      await expect(member.getByText(SC2.content)).not.toBeAttached()
      const frozen = await member
        .getByTestId('escape-room-paused-timer')
        .innerText()
      await member.waitForTimeout(3_000)
      await expect(member.getByTestId('escape-room-paused-timer')).toHaveText(
        frozen
      )
      await expect(projector).toHaveAttribute('data-paused', 'true', {
        timeout: 30_000,
      })
      await captureEvidence(member, 'group-session-paused-en-desktop.png')
      await captureEvidence(page, 'group-session-controls-paused-en-desktop.png')
      await member.setViewportSize({ width: 390, height: 844 })
      await captureEvidence(member, 'group-session-paused-en-mobile.png')
      await member.setViewportSize({ width: 1440, height: 900 })

      // resuming brings the stage back and the timer runs again
      await page.getByTestId('escape-session-resume').click()
      await expect(controls).toHaveAttribute('data-phase', 'RUNNING')
      await expect(member.getByTestId('escape-room-paused')).not.toBeAttached({
        timeout: 20_000,
      })
      await expect(member.getByText(SC2.content).first()).toBeVisible()
      await expect(projector).toHaveAttribute('data-paused', 'false', {
        timeout: 30_000,
      })

      // ending is final: the group sees the ended dialog and the projector closes
      await page.getByTestId('escape-session-end').click()
      await page.getByTestId('confirm-escape-session-end').click()
      await expect(controls).toHaveAttribute('data-phase', 'ENDED')
      await expect(member.getByTestId('escape-room-expired')).toHaveAttribute(
        'data-session-ended',
        'true',
        { timeout: 20_000 }
      )
      await captureEvidence(member, 'group-session-ended-en-desktop.png')
      await expect(projector).toHaveAttribute('data-phase', 'CLOSED', {
        timeout: 30_000,
      })
      await captureEvidence(
        classroom,
        'group-session-projector-closed-en-desktop.png'
      )
      await captureEvidence(page, 'group-session-controls-ended-en-desktop.png')
    } finally {
      await member.context().close()
      await classroom?.context().close()
    }
  })
}
