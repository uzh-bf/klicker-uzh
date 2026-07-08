import { expect, Page } from '@playwright/test'
import { setSessionCookieForUrl } from '../authSession.js'
import {
  LECTURER_EMAIL,
  URL_MANAGE,
  URL_STUDENT_LOGIN,
  USER_ID_TEST,
  viewPorts,
} from '../constants.js'

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
  void options
  const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
  await page.context().clearCookies()
  await setSessionCookieForUrl({
    context: page.context(),
    targetUrl: manageUrl,
    tokenData: {
      email: LECTURER_EMAIL,
      sub: USER_ID_TEST,
      role: 'ADMIN',
      scope: 'ACCOUNT_OWNER',
      catalystInstitutional: true,
      catalystIndividual: true,
    },
  })
  await page.goto(manageUrl)
  await expect(page.getByTestId('homepage')).toBeVisible()
  await expect(page).toHaveURL(new RegExp(manageUrl.replaceAll('.', '\\.')))
  await page.getByTestId('user-menu').click()
}

export async function useStudentContextFixture(
  page: Page,
  options: UseStudentContextOptions
) {
  await page.context().clearCookies()
  await page.goto(process.env.URL_STUDENT_LOGIN ?? URL_STUDENT_LOGIN)
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
