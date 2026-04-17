import { expect, Page } from '@playwright/test'
import { URL_MANAGE, URL_STUDENT_LOGIN, viewPorts } from '../constants.js'

export type UseStudentContextOptions = {
  usernameOrEmail: string
  password: string
  editProfile?: boolean
  newPassword?: string
  viewport?: 'default' | 'mobile'
}

export type UseLecturerContextOptions = {
  usernameOrEmail: string
  password: string
}

export async function useLecturerContextFixture(
  page: Page,
  options: UseLecturerContextOptions
) {
  await page.context().clearCookies()

  // Navigate to the Manage app first so localStorage is accessible on the
  // correct origin before we clear it (evaluating on about:blank or a
  // cross-origin page throws SecurityError).
  await page.goto(URL_MANAGE)
  await page.evaluate(() => {
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {
      // cross-origin or sandboxed — nothing to clear
    }
  })
  await page.waitForTimeout(1000)

  // Fill delegated login form (possibly on a different origin)
  // Enable delegated access if the button is disabled (Terms checkbox)
  const delegatedBtn = page.getByTestId('delegated-login-button')
  if (await delegatedBtn.isDisabled()) {
    await page.getByTestId('tos-checkbox').click()
  }
  await expect(delegatedBtn).toBeEnabled()
  await delegatedBtn.click()

  await page.getByTestId('identifier-field').fill(options.usernameOrEmail)
  await page.getByTestId('password-field').fill(options.password)
  await page.locator('form > button[type=submit]').click()

  await expect(page).toHaveURL(new RegExp(URL_MANAGE))
  await expect(page.getByTestId('homepage')).toBeVisible()
  await page.getByTestId('user-menu').click()
}

export async function useStudentContextFixture(
  page: Page,
  options: UseStudentContextOptions
) {
  await page.context().clearCookies()
  await page.goto(URL_STUDENT_LOGIN)
  await page.setViewportSize(viewPorts[options.viewport || 'default'])

  // login
  await expect(page.getByTestId('login-logo')).toBeVisible()
  await page.getByTestId('username-field').fill(options.usernameOrEmail)
  await page.getByTestId('password-field').fill(options.password)
  await page.getByTestId('submit-login').click()
  await expect(page.getByTestId('homepage')).toBeVisible()

  // try
  if (options.editProfile) {
    await page.getByTestId('header-avatar').click()
    await page.getByTestId('participant-profile-login').click()
    await page.getByTestId('edit-profile').click()

    // Cycle through every avatar select: open, pick second option, verify
    const avatarSelects = [
      'avatar-hair-select',
      'avatar-hairColor-select',
      'avatar-eyes-select',
      'avatar-accessory-select',
      'avatar-mouth-select',
      'avatar-facialHair-select',
      'avatar-clothing-select',
      'avatar-clothingColor-select',
      'avatar-skinTone-select',
    ]

    for (const selector of avatarSelects) {
      const select = page.getByTestId(selector)
      await expect(select).toBeVisible()
      await select.click()
      // Pick the second option in the dropdown (first option is already selected)
      const options = page.locator('[role="option"]')
      await options.nth(1).click()
    }
  }

  if (options.newPassword) {
    await page.getByTestId('header-avatar').click()
    await page.getByTestId('participant-profile-login').click()
    await page.getByTestId('edit-profile').click()
    await page.getByTestId('update-account-password').fill(options.newPassword)
    await page
      .getByTestId('update-account-password-repetition')
      .fill(options.newPassword)
    await page.getByTestId('save-account-update').click()
  }

  // logout
  await page.getByTestId('header-avatar').click()
  await page.getByTestId('logout').click()
  await expect(page.getByTestId('login-logo')).toBeVisible()
  await page.reload()
}
