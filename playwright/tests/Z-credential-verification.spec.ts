import type { Page } from '@playwright/test'
import { cleanupTest } from '../util/cleanup.js'
import {
  ASSESSMENT_REPORT_COURSE_NAME,
  ASSESSMENT_REPORT_COURSE_REFERENCE,
  ASSESSMENT_REPORT_PARTICIPANT_IDS,
  ASSESSMENT_REPORT_SUBJECT_EMAIL,
  COURSE_ID_ASSESSMENT_REPORT,
  URL_MANAGE,
  URL_STUDENT,
} from '../util/constants.js'
import {
  changeAssessmentReportCourseDisplayName,
  changeAssessmentReportSubjectScore,
  expectOneActiveAssessmentReport,
  getAssessmentReportRecords,
  resetAssessmentReportFixture,
  seedAssessmentReportTenBinFixture,
  seedAssessmentReportFixture,
} from '../util/credentialVerification.js'
import { expect, test } from '../util/fixtures.js'
import type { TokenData } from '../util/types.js'

type LoginFactory = (
  tokenData: TokenData,
  cookieName?: string,
  redirectUrl?: string
) => Promise<void>

const assessmentManageUrl = process.env.URL_MANAGE ?? URL_MANAGE
const assessmentStudentUrl = process.env.URL_STUDENT ?? URL_STUDENT

async function loginAssessmentStudent(loginFactory: LoginFactory) {
  await loginFactory(
    {
      email: ASSESSMENT_REPORT_SUBJECT_EMAIL,
      sub: ASSESSMENT_REPORT_PARTICIPANT_IDS[0]!,
      role: 'PARTICIPANT',
      scope: 'ACCOUNT_OWNER',
      catalystInstitutional: false,
      catalystIndividual: false,
    },
    'participant_token',
    assessmentStudentUrl
  )
}

async function exportAssessmentReport(page: Page) {
  await page.context().addInitScript(() => {
    window.print = () => {
      const root = document.documentElement
      const printCalls = Number(root.dataset.assessmentReportPrintCalls ?? '0')
      root.dataset.assessmentReportPrintCalls = String(printCalls + 1)
    }
  })
  await page.goto(
    `${assessmentStudentUrl}/course/${COURSE_ID_ASSESSMENT_REPORT}`
  )
  const exportButton = page.getByTestId('export-report-button')
  await expect(exportButton).toBeVisible()
  await exportButton.click()

  const viewButton = page.getByTestId('view-assessment-report')
  const downloadButton = page.getByTestId('download-assessment-report')
  const refreshButton = page.getByTestId('refresh-assessment-report')
  await expect(viewButton).toBeVisible()
  await expect(downloadButton).toBeVisible()
  await expect(refreshButton).toBeVisible()

  const printWindowPromise = page.waitForEvent('popup')
  const [reportPage] = await Promise.all([
    printWindowPromise,
    downloadButton.click(),
  ])
  await reportPage.waitForLoadState('load')
  await expect(reportPage.locator('html')).toHaveAttribute(
    'data-assessment-report-print-calls',
    '1'
  )
  const content = await reportPage.content()
  const pdf = await reportPage.pdf({
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  })
  const qrCodeSize = await reportPage
    .getByRole('img', { name: 'QR code for the KlickerUZH verification page' })
    .evaluate((image: HTMLImageElement) => ({
      height: image.naturalHeight,
      width: image.naturalWidth,
    }))
  const histogramBarCount = await reportPage.locator('.chart svg rect').count()
  const histogramRowCount = await reportPage
    .locator('.histogram-table tbody tr')
    .count()
  await reportPage.close()
  const match = content.match(/\/verify#([a-f0-9]{64})/)
  if (!match?.[1]) throw new Error('ASSESSMENT_REPORT_TOKEN_MISSING')
  const reportWindowPromise = page.waitForEvent('popup')
  await viewButton.click()
  const viewPage = await reportWindowPromise
  await viewPage.waitForLoadState('load')
  await viewPage.close()
  return {
    content,
    pdf,
    qrCodeSize,
    histogramBarCount,
    histogramRowCount,
    token: match[1],
  }
}

async function revokeThroughLecturerUi({
  page,
  loginLecturer,
  subjectEmail,
}: {
  page: Page
  loginLecturer: () => Promise<void>
  subjectEmail: string
}) {
  await loginLecturer()
  await page.goto(
    `${assessmentManageUrl}/courses/${COURSE_ID_ASSESSMENT_REPORT}/assessment/results`
  )
  await page.getByTestId('assessment-quiz-credentials').click()
  const dialog = page.getByRole('dialog').first()
  await expect(dialog).toContainText('Issued assessment reports')
  const row = dialog.getByRole('row').filter({ hasText: subjectEmail })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Revoke' }).click()

  const confirmation = page.getByRole('dialog').last()
  await expect(confirmation).toContainText(
    'The same unchanged assessment snapshot cannot be issued again'
  )
  await confirmation.getByRole('button', { name: 'Revoke report' }).click()
  await expect(row).toContainText('Revoked')
}

test('CLEANUP', async () => {
  await cleanupTest()
  await seedAssessmentReportFixture()
})

test.describe('Assessment report credential lifecycle', () => {
  test.beforeEach(async () => {
    await resetAssessmentReportFixture()
  })

  test('student saves a self-contained report from the server snapshot', async ({
    page,
    loginFactory,
  }) => {
    await loginAssessmentStudent(loginFactory)
    const {
      content,
      histogramBarCount,
      histogramRowCount,
      pdf,
      qrCodeSize,
      token,
    } = await exportAssessmentReport(page)

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pdf.toString().match(/\/Type\s*\/Page\b/g)).toHaveLength(1)
    expect(histogramBarCount).toBe(3)
    expect(histogramRowCount).toBe(3)
    expect(qrCodeSize).toEqual({ height: 336, width: 336 })
    expect(content).toContain('Universität Zürich')
    expect(content).toContain(
      `<title>Assessment performance report - ${ASSESSMENT_REPORT_COURSE_NAME}</title>`
    )
    expect(content).toContain(ASSESSMENT_REPORT_COURSE_NAME)
    expect(content).toContain(ASSESSMENT_REPORT_COURSE_REFERENCE)
    expect(content).toContain(ASSESSMENT_REPORT_SUBJECT_EMAIL)
    expect(content).toContain('Accepted assessment-course invitation email')
    expect(content).toContain('Peer comparison')
    expect(content).toContain('Europe/Zurich')
    expect(content).toContain('Your score range:')
    expect(content).toContain('(You)')
    expect(content).toContain(`/verify#${token}`)
    expect(content).not.toContain(`/verify/${token}`)
    expect(content).not.toContain('digitally signed')
    expect(content).toContain(
      `Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'`
    )

    const reportPagePromise = page.waitForEvent('popup')
    await page.getByTestId('view-assessment-report').click()
    const reportPage = await reportPagePromise
    await expect(reportPage).toHaveTitle(
      `Assessment performance report - ${ASSESSMENT_REPORT_COURSE_NAME}`
    )
    await expect(
      reportPage.getByRole('heading', {
        name: 'Assessment performance report',
      })
    ).toBeVisible()
    await reportPage.close()

    const histogramBarWidths = Array.from(
      content.matchAll(/<rect x="[^"]+" y="[^"]+" width="([^"]+)"/g),
      (match) => Number(match[1])
    )
    expect(histogramBarWidths[0]).toBeGreaterThan(histogramBarWidths[1]!)

    const record = await expectOneActiveAssessmentReport()
    expect(record.token).toBe(token)
    expect(record.subjectEmail).toBe(ASSESSMENT_REPORT_SUBJECT_EMAIL)
    expect(record.snapshotVersion).toBe(1)
  })

  test('student saves a ten-bin report on one A4 page', async ({
    page,
    loginFactory,
  }) => {
    try {
      await seedAssessmentReportTenBinFixture()
      await loginAssessmentStudent(loginFactory)
      const { content, histogramBarCount, histogramRowCount, pdf } =
        await exportAssessmentReport(page)

      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
      expect(pdf.toString().match(/\/Type\s*\/Page\b/g)).toHaveLength(1)
      expect(histogramBarCount).toBe(10)
      expect(histogramRowCount).toBe(10)
      expect(content).toContain(ASSESSMENT_REPORT_COURSE_NAME)
    } finally {
      await resetAssessmentReportFixture()
    }
  })

  test('student gets a bounded error when the QR logo cannot decode', async ({
    page,
    loginFactory,
  }) => {
    await page.route('**/KlickerLogo.png', async (route) => {
      await route.fulfill({
        body: 'not a PNG image',
        contentType: 'image/png',
        status: 200,
      })
    })
    await loginAssessmentStudent(loginFactory)
    await page.goto(
      `${assessmentStudentUrl}/course/${COURSE_ID_ASSESSMENT_REPORT}`
    )
    const exportButton = page.getByTestId('export-report-button')
    await exportButton.click()

    await expect(
      page.getByRole('alert').filter({
        hasText:
          'The report was issued, but its browser document could not be created. Please try again.',
      })
    ).toBeVisible({ timeout: 15_000 })
    await expect(exportButton).toBeEnabled()
  })

  test('standalone report escapes course-controlled HTML', async ({
    page,
    loginFactory,
  }) => {
    const maliciousName = '</title><script>window.reportInjected=true</script>'
    await changeAssessmentReportCourseDisplayName(maliciousName)
    await loginAssessmentStudent(loginFactory)
    const { content } = await exportAssessmentReport(page)

    expect(content).toContain(
      '&lt;/title&gt;&lt;script&gt;window.reportInjected=true&lt;/script&gt;'
    )
    expect(content).not.toContain('<script')
  })

  test('public verification shows active claims without leaking the token', async ({
    page,
    loginFactory,
  }) => {
    await loginAssessmentStudent(loginFactory)
    const { token } = await exportAssessmentReport(page)
    const requestUrls: string[] = []
    const requestBodies: string[] = []
    page.on('request', (request) => {
      requestUrls.push(request.url())
      if (request.postData()) requestBodies.push(request.postData()!)
    })

    await page.goto(`${assessmentStudentUrl}/verify#${token}`)
    await expect(
      page.getByRole('heading', { name: 'Active assessment record' })
    ).toBeVisible()
    await expect(page.getByText(ASSESSMENT_REPORT_COURSE_NAME)).toBeVisible()
    await expect(
      page.getByText(ASSESSMENT_REPORT_COURSE_REFERENCE)
    ).toBeVisible()
    await expect(page.getByText(ASSESSMENT_REPORT_SUBJECT_EMAIL)).toHaveCount(0)
    await expect(
      page.getByText('Accepted assessment-course invitation email')
    ).toBeVisible()
    await expect(
      page.getByText('Comparison cohort: 10 active participants')
    ).toBeVisible()
    await expect(page.getByText(/Europe\/Zurich/)).toBeVisible()
    await expect(
      page.getByRole('img', { name: /Your score range:/ })
    ).toBeVisible()
    await expect(
      page.getByRole('row').filter({ hasText: '(You)' })
    ).toBeVisible()
    await expect(page.locator('body')).not.toContainText(token)
    expect(requestUrls.some((url) => url.includes(token))).toBe(false)
    expect(requestBodies.some((body) => body.includes(token))).toBe(true)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex,nofollow,noarchive'
    )
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute(
      'content',
      'no-referrer'
    )
    const logo = page.getByRole('img', { name: 'Universität Zürich' })
    await expect(logo).toBeVisible()
    expect(
      await logo.evaluate((image: HTMLImageElement) => image.naturalWidth)
    ).toBeGreaterThan(0)
  })

  test('lecturer can search, copy, and revoke without displaying the full token', async ({
    context,
    page,
    loginFactory,
    loginLecturer,
  }) => {
    await loginAssessmentStudent(loginFactory)
    const { token } = await exportAssessmentReport(page)
    await expectOneActiveAssessmentReport()

    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: assessmentManageUrl,
    })
    await loginLecturer()
    await page.goto(
      `${assessmentManageUrl}/courses/${COURSE_ID_ASSESSMENT_REPORT}/assessment/results`
    )
    await expect(page.getByTestId('assessment-quiz-credentials')).toContainText(
      '(1)'
    )
    await page.getByTestId('assessment-quiz-credentials').click()
    const dialog = page.getByRole('dialog').first()
    const recipientSearch = dialog.getByRole('textbox', {
      name: 'Search recipient email',
    })
    await expect(recipientSearch).toBeVisible()
    await expect(dialog.getByRole('combobox', { name: 'Status' })).toBeVisible()
    await recipientSearch.fill(ASSESSMENT_REPORT_SUBJECT_EMAIL)
    const row = dialog
      .getByRole('row')
      .filter({ hasText: ASSESSMENT_REPORT_SUBJECT_EMAIL })
    await expect(row).toContainText(`${token.slice(0, 8)}...${token.slice(-4)}`)
    await expect(row).not.toContainText(token)
    await expect(row).toContainText('Europe/Zurich')

    let failRecordsRefresh = false
    await page.route('**/*', async (route) => {
      const request = route.request()
      if (
        failRecordsRefresh &&
        request.method() === 'POST' &&
        request.postData()?.includes('QGetCourseVerificationRecords')
      ) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            errors: [{ message: 'ASSESSMENT_REPORT_TEST_REFRESH_FAILED' }],
          }),
        })
        return
      }
      await route.continue()
    })

    await row.getByRole('button', { name: 'Copy verification link' }).click()
    const copiedLink = await page.evaluate(() => navigator.clipboard.readText())
    expect(copiedLink).toContain(`/verify#${token}`)

    await row.getByRole('button', { name: 'Revoke' }).click()
    const confirmation = page.getByRole('dialog').last()
    await expect(confirmation).toContainText(ASSESSMENT_REPORT_SUBJECT_EMAIL)
    failRecordsRefresh = true
    await confirmation.getByRole('button', { name: 'Revoke report' }).click()
    await expect(
      page.getByTestId('confirm-assessment-report-revocation')
    ).not.toBeVisible()
    await expect(
      page.getByText('The assessment report was revoked.')
    ).toBeVisible()
    await expect(page.getByText(/list could not be refreshed/)).toBeVisible()
    await expect(row).toContainText('Revoked')
  })

  test('revoked claims stay redacted while changed authoritative data can reissue', async ({
    page,
    loginFactory,
    loginLecturer,
  }) => {
    await loginAssessmentStudent(loginFactory)
    const first = await exportAssessmentReport(page)
    await revokeThroughLecturerUi({
      page,
      loginLecturer,
      subjectEmail: ASSESSMENT_REPORT_SUBJECT_EMAIL,
    })

    await page.goto(`${assessmentStudentUrl}/verify#${first.token}`)
    await expect(
      page.getByRole('heading', { name: 'Revoked assessment record' })
    ).toBeVisible()
    await expect(page.locator('body')).not.toContainText(
      ASSESSMENT_REPORT_SUBJECT_EMAIL
    )
    await expect(page.locator('body')).not.toContainText(
      ASSESSMENT_REPORT_COURSE_NAME
    )

    await loginAssessmentStudent(loginFactory)
    await page.goto(
      `${assessmentStudentUrl}/course/${COURSE_ID_ASSESSMENT_REPORT}`
    )
    await page.getByTestId('export-report-button').click()
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: 'was revoked and cannot be issued again' })
    ).toBeVisible()

    await changeAssessmentReportSubjectScore()
    await loginAssessmentStudent(loginFactory)
    const replacement = await exportAssessmentReport(page)
    expect(replacement.token).not.toBe(first.token)
    expect(replacement.content).toContain('>3<')

    const records = await getAssessmentReportRecords()
    expect(records.map((record) => record.status).sort()).toEqual([
      'ACTIVE',
      'REVOKED',
    ])
    await page.goto(`${assessmentStudentUrl}/verify#${replacement.token}`)
    await expect(
      page.getByRole('heading', { name: 'Active assessment record' })
    ).toBeVisible()
  })

  test('public route handles missing and malformed fragments locally', async ({
    page,
  }) => {
    await page.goto(`${assessmentStudentUrl}/verify`)
    await expect(
      page.getByRole('heading', { name: 'Invalid verification link' })
    ).toBeVisible()
    await expect(
      page.getByText('does not contain a verification token')
    ).toBeVisible()

    await page.goto(`${assessmentStudentUrl}/verify#not-a-token`)
    await expect(page.getByText('has an invalid format')).toBeVisible()
  })
})
