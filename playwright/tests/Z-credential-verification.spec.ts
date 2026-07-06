import { promises as fs } from 'fs'
import {
  COURSE_ID_TEST,
  LECTURER_PASSWORD,
  LECTURER_SHORTNAME,
  STUDENT_USERNAME,
  URL_MANAGE,
  URL_STUDENT,
} from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'

test.describe('Verifiable Credentials and Performance Report Lifecycles', () => {
  let verificationToken: string | null = null

  test('Student can export performance report, generating a verifiable token and QR code', async ({
    page,
    loginStudentPassword,
  }) => {
    // 1. Log in as a student
    await loginStudentPassword(STUDENT_USERNAME)

    // 2. Go to the Testkurs course page
    await page.goto(`${URL_STUDENT}/course/${COURSE_ID_TEST}`)

    // 3. Open the "Leistungsübersicht" (Assessment Results) tab
    await page.locator('text=Leistungsübersicht').first().click()

    // 4. Expect the export button to be visible and click it to download the report
    const exportButton = page.getByTestId('export-report-button')
    await expect(exportButton).toBeVisible()

    // 5. Intercept the download event
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportButton.click(),
    ])

    const path = await download.path()
    const content = await fs.readFile(path, 'utf8')

    // 6. Verify that the HTML report contains UZH styling and the verification section
    expect(content).toContain('Universität Zürich')
    expect(content).toContain('UZH')
    expect(content).toContain('Offizielle Verifizierung')
    expect(content).toContain('/verify/')

    // 7. Parse the token from the URL in the HTML
    const tokenMatch = content.match(/\/verify\/([a-zA-Z0-9_-]+)/)
    expect(tokenMatch).not.toBeNull()
    verificationToken = tokenMatch![1]
    console.log(`Generated verification token: ${verificationToken}`)
  })

  test('Verification page validates the issued certificate', async ({
    page,
  }) => {
    expect(verificationToken).not.toBeNull()

    // 1. Visit the public verification portal link
    await page.goto(`${URL_STUDENT}/verify/${verificationToken}`)

    // 2. Verify it displays success state, verified status, and course details
    await expect(
      page.locator('text=Status: Verifiziert / Verified')
    ).toBeVisible()
    await expect(page.locator('text=Testkurs')).toBeVisible()
    await expect(page.locator('text=Basispunkte')).toBeVisible()
  })

  test('Lecturer can view list of issued credentials and revoke them', async ({
    page,
    useLecturerContext,
  }) => {
    expect(verificationToken).not.toBeNull()

    // 1. Log in as the lecturer
    await useLecturerContext(page, {
      usernameOrEmail: LECTURER_SHORTNAME,
      password: LECTURER_PASSWORD,
    })

    // 2. Go to the course assessment results page
    await page.goto(
      `${URL_MANAGE}/courses/${COURSE_ID_TEST}/assessment/results`
    )

    // 3. Click the "Zertifikate / Credentials" button to open the log
    const credentialsButton = page.getByTestId('assessment-quiz-credentials')
    await expect(credentialsButton).toBeVisible()
    await credentialsButton.click()

    // 4. Expect the modal to open
    await expect(
      page.locator(
        'text=Ausgestellte Leistungsberichte / Issued Performance Reports'
      )
    ).toBeVisible()

    // 5. Locate the row with our verification token
    const tokenCell = page.locator(`text=${verificationToken}`)
    await expect(tokenCell).toBeVisible()

    // 6. Handle the confirmation dialog and click the "Widerrufen" (Revoke) button in the row
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('widerrufen')
      await dialog.accept()
    })

    const row = page.locator('tr').filter({ hasText: verificationToken! })
    const revokeButton = row.locator('text=Widerrufen / Revoke')
    await expect(revokeButton).toBeVisible()
    await revokeButton.click()

    // 7. Verify the status changes to Revoked in the list
    await expect(row.locator('text=Widerrufen / Revoked')).toBeVisible()
  })

  test('Verification page correctly displays revoked status', async ({
    page,
  }) => {
    expect(verificationToken).not.toBeNull()

    // 1. Visit the verification portal link again
    await page.goto(`${URL_STUDENT}/verify/${verificationToken}`)

    // 2. Verify it now displays the revoked banner
    await expect(
      page.locator('text=Status: Widerrufen / Revoked')
    ).toBeVisible()
    await expect(
      page.locator(
        'text=Dieses Dokument wurde vom Dozenten oder der Universität Zürich widerrufen'
      )
    ).toBeVisible()
  })
})
