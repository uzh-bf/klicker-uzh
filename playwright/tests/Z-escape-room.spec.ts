// @ts-nocheck
import { expect } from '@playwright/test'
import {
  LECTURER_PASSWORD,
  LECTURER_SHORTNAME,
  STUDENT_PASSWORD,
  STUDENT_USERNAME,
} from '../util/constants.js'
import { test } from '../util/fixtures.js'
import { loginLecturer, loginStudent } from '../util/workflow.js'

test.describe.serial('Escape Room Quiz E2E Workflows', () => {
  let quizName = `Escape Room Test ${Date.now()}`
  let courseName = 'Testkurs' // default seeded course

  test('Create Escape Room Practice Quiz', async ({ page }) => {
    // 1. Login as lecturer
    await loginLecturer(page, {
      usernameOrEmail: LECTURER_SHORTNAME,
      password: LECTURER_PASSWORD,
    })

    // 2. Click create practice quiz
    await page.getByTestId('create-practice-quiz').click()
    await page.getByTestId('insert-practice-quiz-name').fill(quizName)
    await page.getByTestId('next-or-submit').click()

    await page.getByTestId('insert-practice-quiz-display-name').fill(quizName)
    await page.getByTestId('next-or-submit').click()

    // 3. Select Course & Enable Escape Room Mode
    await page.locator('[data-cy="select-course"]').click()
    await page
      .locator(`div[role="option"]:has-text("${courseName}")`)
      .first()
      .click()

    // Toggle Escape Room Mode
    await page.locator('[data-cy="toggle-escape-room"]').click()
    await page.locator('[data-cy="escape-room-time-limit"]').fill('10') // 10 minutes
    await page.locator('[data-cy="escape-room-hint-penalty"]').fill('30') // 30 seconds
    await page.getByTestId('next-or-submit').click()

    // 4. Create stacks with at least one question
    await page.getByTestId('create-stack').click()
    await page.getByTestId('insert-stack-display-name-0').fill('Stack 1')
    await page.getByTestId('add-element-0').click()

    // Add SC element
    await page.getByTestId('select-element-type-SC').click()
    await page.getByTestId('select-element-SC').first().click()
    await page.getByTestId('insert-element-title').fill('Question 1')
    await page.getByTestId('insert-element-content').fill('What is 2+2?')
    await page.getByTestId('sc-answer-option-0').fill('4')
    await page.getByTestId('toggle-sc-answer-option-0-correct').click()
    await page.getByTestId('sc-answer-option-1').fill('5')
    await page.getByTestId('save-element').click()

    await page.getByTestId('next-or-submit').click()

    // 5. Publish
    await page.getByTestId(`publish-practice-quiz`).click()
    await page.getByTestId('confirm-dialog-confirm').click()
  })

  test('Student Solves Escape Room Practice Quiz', async ({ page }) => {
    // 1. Log in as student
    await loginStudent(page, {
      usernameOrEmail: STUDENT_USERNAME,
      password: STUDENT_PASSWORD,
    })

    // 2. Navigate to course page and open the quiz
    await page.goto('/')
    await page.getByText(courseName).first().click()
    await page.getByText(quizName).first().click()

    // 3. Verify Escape Room Start overlay is shown
    await expect(page.getByText('Escape Room Mode')).toBeVisible()
    await expect(page.getByText('10 min')).toBeVisible()
    await expect(page.getByText('+30s')).toBeVisible()

    // 4. Click Start Attempt
    await page.locator('button:has-text("Start Attempt")').click()

    // 5. Verify timer is active and visible
    await expect(page.getByText('Escape Room')).toBeVisible()
    // It should count down from 10:00, e.g. showing "09:" or "10:00"
    const timerText = await page
      .locator('span:has-text(":")')
      .first()
      .textContent()
    expect(timerText).toMatch(/^(09|10):[0-5][0-9]$/)

    // 6. Answer correctly
    await page.getByTestId('sc-0-answer-option-0').click()
    await page.getByTestId('student-stack-submit').click()

    // 7. Verify we get the success overlay
    await page.getByTestId('student-stack-continue').click()
    await expect(page.getByText('Escaped successfully!')).toBeVisible()
  })
})
