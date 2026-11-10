import { readFile } from 'node:fs/promises'
import enMessages from '../../packages/i18n/messages/en.js'
import { URL_MANAGE } from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'
import { setAiSettingsMode } from '../util/fixtures/manage.js'

for (const scenario of [
  'fresh indexed sources',
  'a visible refresh error',
  'completion during a filter request',
  'reconciliation of loaded pages',
]) {
  test(`ingestion outside the visible resource list settles with ${scenario}`, async ({
    loginLecturer,
    page,
  }, testInfo) => {
    await setAiSettingsMode(page, 'advanced')
    await loginLecturer()
    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    const kbName = `Settlement regression ${Date.now()}`
    const refreshFails = scenario === 'a visible refresh error'
    let inventoryUnavailable = refreshFails
    let releaseInventoryRetry = () => {}
    const inventoryRetryGate = new Promise<void>((resolve) => {
      releaseInventoryRetry = resolve
    })
    const delayedFilter = scenario === 'completion during a filter request'
    const multiplePages = scenario === 'reconciliation of loaded pages'
    let releaseFilter = () => {}
    const filterGate = new Promise<void>((resolve) => {
      releaseFilter = resolve
    })
    let filteredRequests = 0
    let reconciliationFailures = 0
    let settled = false
    let inventoryRequests = 0
    let resourceRequests = 0
    const persistedOperations = JSON.parse(
      await readFile(
        new URL('../../packages/graphql/dist/client.json', import.meta.url),
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
        const variables =
          payload?.variables ??
          JSON.parse(url.searchParams.get('variables') ?? '{}')
        if (delayedFilter && variables.search) {
          filteredRequests += 1
          await filterGate
        }
        const secondPage = Boolean(variables.after)
        if (
          multiplePages &&
          secondPage &&
          settled &&
          reconciliationFailures === 0
        ) {
          reconciliationFailures += 1
          await route.fulfill({
            json: { errors: [{ message: 'Synthetic reconciliation failure' }] },
          })
          return
        }
        const items = multiplePages
          ? Array.from({ length: secondPage ? 1 : 20 }, (_, index) => ({
              id: `synthetic-resource-${secondPage ? 20 : index}`,
              type: 'BLOB',
              materialType: 'COURSE_CONTENT',
              title: secondPage
                ? settled
                  ? 'Reconciled second page'
                  : 'Previous second page'
                : `Synthetic resource ${index}`,
              sourceUrl: null,
              originalFilename: 'synthetic.txt',
              mimeType: 'text/plain',
              sizeBytes: 14,
              status: 'READY',
              ingestedAt: '2026-09-21T14:44:00.000Z',
              resourceVersion: 1,
              activeResourceVersion: 1,
              latestIngestionRun: null,
              createdAt: '2026-09-21T14:44:00.000Z',
              updatedAt: '2026-09-21T14:44:00.000Z',
            }))
          : []
        // The active resource is outside the loaded window. Only the global
        // count exposes its activity; no rendered row can drive polling.
        await route.fulfill({
          json: {
            data: {
              getKbResources: {
                items,
                pageInfo: {
                  hasNextPage: multiplePages && !secondPage,
                  endCursor: multiplePages && !secondPage ? 'page-two' : null,
                },
                totalCount: multiplePages ? 21 : 0,
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
        if (settled && inventoryUnavailable) {
          await route.fulfill({
            json: { errors: [{ message: 'Synthetic refresh failure' }] },
          })
          return
        }
        if (settled && refreshFails) await inventoryRetryGate
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
      const inventory = page.getByTestId('kb-imported-sources')
      await expect(inventory).toContainText('Previously indexed document')
      await expect(page.getByTestId('kb-background-operations')).toBeVisible()
      const requestsBeforeFilter = inventoryRequests
      if (multiplePages) {
        await page.getByTestId('load-more-kb-resources').click()
        await expect(
          page.getByText('Previous second page', { exact: true })
        ).toBeVisible()
      } else {
        await page.getByTestId('kb-resource-search').fill('outside-the-filter')
      }
      if (delayedFilter) {
        await expect.poll(() => filteredRequests).toBeGreaterThan(0)
        await expect(page.getByTestId('kb-background-operations')).toBeVisible()
        expect(inventoryRequests).toBe(requestsBeforeFilter)
      }
      const requestsBeforePolling = resourceRequests
      if (!delayedFilter) {
        await expect
          .poll(() => resourceRequests, { timeout: 15000 })
          .toBeGreaterThan(requestsBeforePolling + 1)
      }
      await page.screenshot({
        path: testInfo.outputPath('before-settlement.png'),
        fullPage: true,
      })
      const requestsBeforeSettlement = inventoryRequests
      settled = true
      releaseFilter()
      if (multiplePages) {
        await expect(
          page.getByText(enMessages.kb.resourcesLoadError)
        ).toBeVisible()
        await expect(page.getByTestId('kb-background-operations')).toBeVisible()
        expect(inventoryRequests).toBe(requestsBeforeSettlement)
      }
      await expect
        .poll(() => inventoryRequests, { timeout: 15000 })
        .toBeGreaterThan(requestsBeforeSettlement)
      await expect(page.getByTestId('kb-background-operations')).toBeHidden()
      await expect(page.getByTestId('kb-ingestion-summary')).toContainText(
        '0 already in progress'
      )
      if (multiplePages) {
        expect(reconciliationFailures).toBe(1)
        await expect(
          page.getByText('Synthetic resource 0', { exact: true })
        ).toBeVisible()
        await expect(
          page.getByText('Reconciled second page', { exact: true })
        ).toBeVisible()
        await expect(
          page.getByText('Previous second page', { exact: true })
        ).toBeHidden()
      }
      if (refreshFails) {
        const refreshError = page.getByTestId(
          'kb-imported-sources-refresh-error'
        )
        const retry = page.getByTestId('retry-imported-sources-refresh')
        await expect(refreshError).toContainText(
          enMessages.kb.importedSourcesLoadError
        )
        await expect(inventory).toContainText('Previously indexed document')
        await inventory.screenshot({
          path: testInfo.outputPath('refresh-failed.png'),
        })
        const requestsBeforeRetry = inventoryRequests
        await retry.click()
        await expect.poll(() => inventoryRequests).toBe(requestsBeforeRetry + 1)
        await expect(retry).toBeEnabled()
        await expect(refreshError).toBeVisible()
        await expect(inventory).toContainText('Previously indexed document')

        inventoryUnavailable = false
        await retry.click()
        await expect(retry).toBeDisabled()
        await expect(inventory).toContainText('Previously indexed document')
        releaseInventoryRetry()
        await expect(inventory).toContainText('Newly indexed document')
        await expect(inventory).not.toContainText('Previously indexed document')
        await expect(refreshError).toBeHidden()
        await expect(retry).toBeHidden()
      } else {
        await expect(inventory).toContainText('Newly indexed document')
        await expect(inventory).not.toContainText('Previously indexed document')
      }
      await page.screenshot({
        path: testInfo.outputPath('after-settlement.png'),
        fullPage: true,
      })
    } finally {
      releaseFilter()
      releaseInventoryRetry()
      await page.unroute('**/graphql*')
      await page.goto(`${manageUrl}/resources/knowledgeBases`)
      const row = page.locator('li').filter({ hasText: kbName })
      await row.getByRole('button', { name: /Delete|Löschen/ }).click()
      await page.getByTestId('confirm-delete-knowledge-base').click()
      await expect(row).toHaveCount(0)
    }
  })
}
