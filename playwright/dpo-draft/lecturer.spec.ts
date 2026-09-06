import { expect, test } from '@playwright/test'

const manage = process.env.URL_MANAGE ?? 'http://127.0.0.1:3002'

test('assessment export requires a fresh acknowledgement on every opening', async ({
  page,
}) => {
  const downloads: string[] = []
  page.on('download', (download) => downloads.push(download.url()))
  await page.goto(`${manage}/de/dpo-draft`)
  await page.getByTestId('dpo-open-assessment-export').click()
  await expect(page.getByTestId('dpo-submit-assessment-export')).toBeDisabled()
  await page.getByTestId('dpo-assessment-export-acknowledgement').check()
  await page.getByTestId('dpo-submit-assessment-export').click()
  await expect(page.getByTestId('dpo-assessment-export-result')).toBeVisible()
  await page.getByTestId('dpo-cancel-assessment-export').click()
  await page.getByTestId('dpo-open-assessment-export').click()
  await expect(
    page.getByTestId('dpo-assessment-export-acknowledgement')
  ).not.toBeChecked()
  await expect(page.getByTestId('dpo-submit-assessment-export')).toBeDisabled()
  expect(downloads).toEqual([])
})

test('research request rejects incomplete fields and past dates without producing an export', async ({
  page,
}) => {
  const requests: string[] = []
  page.on('request', (request) => {
    if (
      ['fetch', 'xhr', 'ping'].includes(request.resourceType()) &&
      !new URL(request.url()).pathname.startsWith('/_next/')
    )
      requests.push(request.url())
  })
  await page.goto(`${manage}/en/dpo-draft`)
  await page.getByTestId('dpo-open-research-export').click()
  await expect(page.getByTestId('dpo-submit-research-export')).toBeDisabled()
  await page.getByTestId('dpo-research-project-title').fill('   ')
  await page.getByTestId('dpo-research-project-title').press('Enter')
  await expect(page.getByTestId('dpo-research-export-result')).toHaveCount(0)
  await page
    .getByTestId('dpo-research-responsible-person')
    .fill('Synthetic reviewer')
  await page.getByTestId('dpo-research-contact-address').fill('invalid')
  await page
    .getByTestId('dpo-research-purpose')
    .fill('Synthetic validation only.')
  const dates = await page.evaluate(() => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const local = (date: Date) =>
      [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
      ].join('-')
    return { today: local(today), yesterday: local(yesterday) }
  })
  await page.getByTestId('dpo-research-deletion-date').fill(dates.yesterday)
  await page.getByTestId('dpo-research-export-acknowledgement').check()
  await expect(page.getByTestId('dpo-submit-research-export')).toBeDisabled()
  await page.getByTestId('dpo-research-project-title').fill('Synthetic study')
  await page
    .getByTestId('dpo-research-contact-address')
    .fill('research@example.invalid')
  await page.getByTestId('dpo-research-class-live-quiz').check()
  await expect(page.getByTestId('dpo-submit-research-export')).toBeDisabled()
  await page.getByTestId('dpo-research-deletion-date').fill(dates.today)
  await expect(page.getByTestId('dpo-submit-research-export')).toBeEnabled()
  await page.getByTestId('dpo-research-class-live-quiz').uncheck()
  await expect(page.getByTestId('dpo-submit-research-export')).toBeDisabled()
  await page.getByTestId('dpo-research-class-chat-transcripts').check()
  await page.getByTestId('dpo-submit-research-export').click()
  await expect(page.getByTestId('dpo-research-export-result')).toBeVisible()
  await page.getByTestId('dpo-research-export-acknowledgement').uncheck()
  await expect(page.getByTestId('dpo-research-export-result')).toHaveCount(0)
  expect(requests).toEqual([])
})

test('knowledge-base confirmations reset on scenario changes and reopening', async ({
  page,
}) => {
  await page.goto(`${manage}/de/dpo-draft`)
  await page.getByTestId('dpo-open-knowledge-upload').click()
  await expect(page.getByTestId('dpo-submit-knowledge-upload')).toBeDisabled()
  await page.getByTestId('dpo-knowledge-rights-acknowledgement').check()
  await expect(page.getByTestId('dpo-submit-knowledge-upload')).toBeDisabled()
  await page.getByTestId('dpo-knowledge-privacy-acknowledgement').check()
  await expect(page.getByTestId('dpo-submit-knowledge-upload')).toBeEnabled()
  await page.getByTestId('dpo-knowledge-upload-scenario').click()
  await page.getByRole('option').nth(1).click()
  await expect(
    page.getByTestId('dpo-knowledge-rights-acknowledgement')
  ).not.toBeChecked()
  await expect(
    page.getByTestId('dpo-knowledge-privacy-acknowledgement')
  ).not.toBeChecked()
  await page.getByTestId('dpo-cancel-knowledge-upload').click()
  await page.getByTestId('dpo-open-knowledge-upload').click()
  await expect(page.getByTestId('dpo-submit-knowledge-upload')).toBeDisabled()
  await expect(page.locator('input[type=file]')).toHaveCount(0)
})
