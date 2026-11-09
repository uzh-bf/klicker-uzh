import { readFile } from 'node:fs/promises'
import enMessages from '../../packages/i18n/messages/en.js'
import { URL_MANAGE } from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'
import { setAiSettingsMode } from '../util/fixtures/manage.js'

for (const refreshFails of [false, true]) {
  test(`ingestion outside the visible resource list settles with ${refreshFails ? 'a visible refresh error' : 'fresh indexed sources'}`, async ({
    loginLecturer,
    page,
  }, testInfo) => {
    await setAiSettingsMode(page, 'advanced')
    await loginLecturer()
    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    const kbName = `Settlement regression ${Date.now()}`
    let settled = false
    let inventoryRequests = 0
    let resourceRequests = 0
    const persistedOperations = JSON.parse(
      await readFile(
        new URL(
          '../../packages/graphql/src/public/client.json',
          import.meta.url
        ),
        'utf8'
      )
    ) as Record<string, string>
    const persistedNames = Object.fromEntries(
      Object.entries(persistedOperations).map(([name, hash]) => [hash, name])
    )

    await page.goto(`${manageUrl}/resources/knowledgeBases`)
    await expect(page.getByTestId('knowledge-base-loading')).toBeHidden()
    await page.getByTestId('create-knowledge-base').click()
    await page.getByTestId('knowledge-base-name').fill(kbName)
    await page.getByTestId('submit-create-knowledge-base').click()
    const kbLink = page.getByRole('link').filter({ hasText: kbName })
    await expect(kbLink).toBeVisible()

    await page.route('**/graphql*', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const payload =
        request.method() === 'POST' ? request.postDataJSON() : null
      const extensions =
        payload?.extensions ??
        JSON.parse(url.searchParams.get('extensions') ?? '{}')
      const operation =
        payload?.operationName ??
        url.searchParams.get('operationName') ??
        persistedNames[extensions.persistedQuery?.sha256Hash]
      if (operation === 'GetKbResourcesWithFailureDetail') {
        resourceRequests += 1
        // The active resource is outside the loaded window. Only the global
        // count exposes its activity; no rendered row can drive polling.
        await route.fulfill({
          json: {
            data: {
              getKbResources: {
                items: [],
                pageInfo: { hasNextPage: false, endCursor: null },
                totalCount: 0,
                needsIngestionCount: 0,
                failedIngestionCount: 0,
                inProgressCount: settled ? 0 : 1,
              },
            },
          },
        })
        return
      }
      if (operation === 'GetKbImportedSources') {
        inventoryRequests += 1
        if (settled && refreshFails) {
          await route.fulfill({
            status: 500,
            json: { errors: [{ message: 'Synthetic refresh failure' }] },
          })
          return
        }
        await route.fulfill({
          json: {
            data: {
              getKbImportedSources: {
                items: [
                  {
                    id: 'synthetic-inventory',
                    origin: 'MANAGED',
                    sourceType: 'document',
                    title: settled
                      ? 'Newly indexed document'
                      : 'Previously indexed document',
                    sourceUrl: null,
                    ingestedAt: '2026-09-21T14:44:00.000Z',
                    observedAt: '2026-09-21T14:44:00.000Z',
                    chunkCount: 1,
                  },
                ],
                pageInfo: { hasNextPage: false, endCursor: null },
                totalSourcesInScan: 1,
                incomplete: false,
                unidentifiedChunks: 0,
              },
            },
          },
        })
        return
      }
      await route.continue()
    })

    try {
      await kbLink.click()
      await page.getByTestId('kb-resource-search').fill('outside-the-filter')
      const inventory = page.getByTestId('kb-imported-sources')
      await expect(inventory).toContainText('Previously indexed document')
      await expect(page.getByTestId('kb-background-operations')).toBeVisible()
      const requestsBeforePolling = resourceRequests
      await expect
        .poll(() => resourceRequests, { timeout: 15000 })
        .toBeGreaterThan(requestsBeforePolling + 1)
      await page.screenshot({
        path: testInfo.outputPath('before-settlement.png'),
        fullPage: true,
      })
      const requestsBeforeSettlement = inventoryRequests
      settled = true
      await expect
        .poll(() => inventoryRequests)
        .toBeGreaterThan(requestsBeforeSettlement)
      await expect(page.getByTestId('kb-background-operations')).toBeHidden()
      await expect(page.getByTestId('kb-ingestion-summary')).toContainText(
        '0 already in progress'
      )
      if (refreshFails) {
        await expect(
          page.getByText(enMessages.kb.importedSourcesLoadError)
        ).toBeVisible()
        await expect(inventory).toContainText('Previously indexed document')
      } else {
        await expect(inventory).toContainText('Newly indexed document')
        await expect(inventory).not.toContainText('Previously indexed document')
      }
      await page.screenshot({
        path: testInfo.outputPath('after-settlement.png'),
        fullPage: true,
      })
    } finally {
      await page.unroute('**/graphql*')
      await page.goto(`${manageUrl}/resources/knowledgeBases`)
      const row = page.locator('li').filter({ hasText: kbName })
      await row.getByRole('button', { name: /Delete|Löschen/ }).click()
      await page.getByTestId('confirm-delete-knowledge-base').click()
      await expect(row).toHaveCount(0)
    }
  })
}
