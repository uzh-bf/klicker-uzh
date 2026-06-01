import { cleanupTest } from '../util/cleanup.js'
import {
  LECTURER_PASSWORD,
  LECTURER_SHORTNAME,
  STUDENT_EMAIL,
  STUDENT_PASSWORD,
  STUDENT_USERNAME,
  viewPorts,
} from '../util/constants.js'
import { test } from '../util/fixtures.js'

test('CLEANUP', cleanupTest)

test.describe('Login / Logout workflows for lecturer and students', () => {
  // -------------------------------------------------------------------------
  // Student: basic sign-in and sign-out
  // -------------------------------------------------------------------------
  test('Sign in to student account', async ({ page, useStudentContext }) => {
    await useStudentContext(page, {
      usernameOrEmail: STUDENT_USERNAME,
      password: STUDENT_PASSWORD,
    })
  })

  // -------------------------------------------------------------------------
  // Student: mobile viewport
  // -------------------------------------------------------------------------
  test('Sign in to student account on mobile', async ({
    page,
    useStudentContext,
  }) => {
    await useStudentContext(page, {
      usernameOrEmail: STUDENT_USERNAME,
      password: STUDENT_PASSWORD,
      viewport: 'mobile',
    })

    // restore desktop viewport for subsequent tests
    await page.setViewportSize(viewPorts.default)
  })

  // -------------------------------------------------------------------------
  // Student: avatar profile editing
  // -------------------------------------------------------------------------
  test('Sign in to the student account and tries to modify the profile settings', async ({
    page,
    useStudentContext,
  }) => {
    await useStudentContext(page, {
      usernameOrEmail: STUDENT_USERNAME,
      password: STUDENT_PASSWORD,
      editProfile: true,
    })
  })

  // -------------------------------------------------------------------------
  // Student: password change and revert
  // -------------------------------------------------------------------------
  test('Sign in into student account and modifies the password', async ({
    page,
    useStudentContext,
  }) => {
    const newPassword = 'newPassword123!'

    // Change password
    await useStudentContext(page, {
      usernameOrEmail: STUDENT_USERNAME,
      password: STUDENT_PASSWORD,
      newPassword: newPassword,
    })

    // Revert password back to original
    await useStudentContext(page, {
      usernameOrEmail: STUDENT_USERNAME,
      password: newPassword,
      newPassword: STUDENT_PASSWORD,
    })

    // Confirm revert
    await useStudentContext(page, {
      usernameOrEmail: STUDENT_USERNAME,
      password: STUDENT_PASSWORD,
    })
  })

  // -------------------------------------------------------------------------
  // Student: login via email address
  // -------------------------------------------------------------------------
  test('Sign in into student account with the students email', async ({
    page,
    useStudentContext,
  }) => {
    await useStudentContext(page, {
      usernameOrEmail: STUDENT_EMAIL,
      password: STUDENT_PASSWORD,
    })
  })

  // -------------------------------------------------------------------------
  // Lecturer: delegated login via the Auth app
  // -------------------------------------------------------------------------
  test('Sign in into lecturer account', async ({
    page,
    useLecturerContext,
  }) => {
    await useLecturerContext(page, {
      usernameOrEmail: LECTURER_SHORTNAME,
      password: LECTURER_PASSWORD,
    })
  })
})
