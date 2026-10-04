import { expect, test } from '@playwright/test'

test('signup requires an explicit LA choice and acknowledgement, including Enter', async ({
  page,
}) => {
  const unexpectedRequests: string[] = []
  page.on('request', (request) => {
    if (
      ['fetch', 'xhr', 'ping'].includes(request.resourceType()) &&
      !new URL(request.url()).pathname.startsWith('/_next/')
    )
      unexpectedRequests.push(request.url())
  })
  await page.goto('/de/dpo-draft')
  await expect(page.getByTestId('dpo-account-la-true')).toHaveAttribute(
    'aria-checked',
    'false'
  )
  await expect(page.getByTestId('dpo-account-la-false')).toHaveAttribute(
    'aria-checked',
    'false'
  )
  await expect(page.getByTestId('dpo-ack')).not.toBeChecked()
  await page.getByTestId('dpo-account-research-details').click()
  await expect(page.getByTestId('dpo-account-research-allow')).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await page.getByTestId('dpo-email').fill('draft@example.invalid')
  await page.getByTestId('dpo-username').fill('draft_user')
  await page.getByTestId('dpo-password').fill('synthetic-pass')
  await page.getByTestId('dpo-password').press('Enter')
  await expect(page.getByTestId('dpo-account-result')).toHaveCount(0)
  await expect(page.getByTestId('dpo-account-submit')).toBeDisabled()
  await page.getByTestId('dpo-account-la-false').click()
  await expect(page.getByTestId('dpo-account-submit')).toBeDisabled()
  await page.getByTestId('dpo-ack').check()
  await expect(page.getByTestId('dpo-account-submit')).toBeEnabled()
  await page.getByTestId('dpo-password').press('Enter')
  await expect(page.getByTestId('dpo-account-result')).toBeVisible()
  expect(unexpectedRequests).toEqual([])
})

test('account constraints and research objection remain independent of LA', async ({
  page,
}) => {
  await page.goto('/en/dpo-draft')
  await page.getByTestId('dpo-email').fill('invalid')
  await page.getByTestId('dpo-username').fill('occupied')
  await page.getByTestId('dpo-password').fill('short')
  await page.getByTestId('dpo-account-la-true').click()
  await page.getByTestId('dpo-ack').check()
  await expect(page.getByTestId('dpo-account-submit')).toBeDisabled()
  await page.getByTestId('dpo-email').fill('draft@example.invalid')
  await page.getByTestId('dpo-password').fill('synthetic-pass')
  await expect(page.getByTestId('dpo-account-submit')).toBeDisabled()
  for (const username of ['abcd', 'abcdefghijklmnop']) {
    await page.getByTestId('dpo-username').fill(username)
    await expect(page.getByTestId('dpo-account-submit')).toBeDisabled()
  }
  await page.getByTestId('dpo-username').fill('draft_user')
  await page.getByTestId('dpo-account-research-details').click()
  await page.getByTestId('dpo-account-research-object').click()
  await expect(page.getByTestId('dpo-account-la-true')).toHaveAttribute(
    'aria-checked',
    'true'
  )
  await expect(page.getByTestId('dpo-account-submit')).toBeEnabled()
  await page.getByTestId('dpo-ack').uncheck()
  await expect(page.getByTestId('dpo-account-submit')).toBeDisabled()
})

test('account notices expand independently and guide assets are accessible', async ({
  page,
  request,
}) => {
  await page.goto('/de/dpo-draft')
  await page.getByTestId('dpo-notice-collection').click()
  await page.getByTestId('dpo-notice-retention').click()
  await expect(page.getByTestId('dpo-notice-collection')).toHaveAttribute(
    'aria-expanded',
    'true'
  )
  await expect(page.getByTestId('dpo-notice-retention')).toHaveAttribute(
    'aria-expanded',
    'true'
  )
  await page.getByTestId('dpo-account-guide').click()
  await expect(page).toHaveURL(/\/api\/dpo-draft-assets\/guide$/)
  const downloads = page.locator('a[download]')
  await expect(downloads.first()).toBeVisible()
  for (const link of await downloads.all()) {
    const href = await link.getAttribute('href')
    expect(href).toMatch(/^\/api\/dpo-draft-assets\/[^/]+\.xlsx$/)
    const response = await request.get(href!)
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('spreadsheetml')
    expect(response.headers()['cache-control']).toBe('no-store')
  }
  const unknownAsset = await request.get('/api/dpo-draft-assets/__proto__')
  expect(unknownAsset.status()).toBe(404)
})
