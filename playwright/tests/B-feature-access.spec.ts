import { seedActivities } from '../global-setup.js'
import { cleanupTest } from '../util/cleanup.js'
import { expect, test } from '../util/fixtures.js'
import { updateLecturerPreviewFlags } from '../util/fixtures/manage.js'

test('CLEANUP', cleanupTest)

test.describe('Tests the availability of standard activity creation formats', () => {
  test.beforeAll(async () => {
    await seedActivities()
  })

  test.afterAll(async () => {
    // Restore lecturer flags to defaults for subsequent specs
    await updateLecturerPreviewFlags({
      publicPreview: true,
      privatePreview: true,
    })
  })

  test('Test login for catalyst users and non-catalyst users', async ({
    page,
    loginLecturer,
    loginFreeUser,
    loginIndividualCatalyst,
    loginInstitutionalCatalyst,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('homepage')).toBeVisible()

    await loginFreeUser()
    await expect(page.getByTestId('homepage')).toBeVisible()

    await loginIndividualCatalyst()
    await expect(page.getByTestId('homepage')).toBeVisible()

    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('homepage')).toBeVisible()
  })

  test('Test that all standard creation buttons are enabled for free users', async ({
    page,
    loginFreeUser,
  }) => {
    await loginFreeUser()
    await expect(page.getByTestId('homepage')).toBeVisible()

    await expect(page.getByTestId('create-live-quiz')).not.toBeDisabled()
    await expect(page.getByTestId('create-practice-quiz')).not.toBeDisabled()
    await expect(page.getByTestId('create-microlearning')).not.toBeDisabled()
    await expect(page.getByTestId('create-group-activity')).not.toBeDisabled()
  })

  test('Test that all standard creation buttons are enabled for catalyst users', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('homepage')).toBeVisible()

    await expect(page.getByTestId('create-live-quiz')).not.toBeDisabled()
    await expect(page.getByTestId('create-practice-quiz')).not.toBeDisabled()
    await expect(page.getByTestId('create-microlearning')).not.toBeDisabled()
    await expect(page.getByTestId('create-group-activity')).not.toBeDisabled()
  })

  test('Verify that both public and private preview features are available for lecturer', async ({
    page,
    loginLecturer,
    validateFeatureAvailability,
  }) => {
    await loginLecturer()
    await validateFeatureAvailability(page, {
      publicPreview: true,
      privatePreview: true,
    })
  })

  test('Verify that only the public preview features are available if the corresponding flag is set', async ({
    page,
    loginLecturer,
    validateFeatureAvailability,
  }) => {
    await updateLecturerPreviewFlags({
      publicPreview: true,
      privatePreview: false,
    })
    await loginLecturer()
    await page.reload()
    await validateFeatureAvailability(page, {
      publicPreview: true,
      privatePreview: false,
    })
  })

  test('Verify that only private preview features are available if the corresponding flag is set', async ({
    page,
    loginLecturer,
    validateFeatureAvailability,
  }) => {
    await updateLecturerPreviewFlags({
      publicPreview: false,
      privatePreview: true,
    })
    await loginLecturer()
    await page.reload()
    await validateFeatureAvailability(page, {
      publicPreview: false,
      privatePreview: true,
    })
  })

  test('Verify that without feature flags, preview features are not visible', async ({
    page,
    loginLecturer,
    validateFeatureAvailability,
  }) => {
    await updateLecturerPreviewFlags({
      publicPreview: false,
      privatePreview: false,
    })
    await loginLecturer()
    await page.reload()
    await validateFeatureAvailability(page, {
      publicPreview: false,
      privatePreview: false,
    })
  })
})
