import { readFile } from 'node:fs/promises'
import { URL_MANAGE } from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'
import { selectOption } from '../util/fixtures/activities.js'

test.describe('Knowledge base management workspace', () => {
  test('keeps the resource workspace scannable and add flow keyboard-accessible in English and German', async ({
    loginLecturer,
    page,
  }, testInfo) => {
    await loginLecturer()

    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    const kbName = `UX review ${Date.now()}`
    const resourceTitle = `UX website ${Date.now()}`
    let detailPath: string | undefined
    let importedSourceMode: 'data' | 'empty' | 'error' | 'incomplete' = 'data'

    try {
      await page.goto(`${manageUrl}/resources/knowledgeBases`)
      await expect(
        page.getByRole('main').getByRole('heading', { level: 1 })
      ).toBeVisible()
      await expect(page.getByTestId('knowledge-base-loading')).toBeHidden()

      await page.getByTestId('create-knowledge-base').click()
      await page.getByTestId('knowledge-base-name').fill(kbName)
      await page.getByTestId('submit-create-knowledge-base').click()

      const knowledgeBaseLink = page
        .getByRole('link')
        .filter({ hasText: kbName })
      await expect(knowledgeBaseLink).toBeVisible()
      detailPath = new URL(
        (await knowledgeBaseLink.getAttribute('href')) ?? '',
        manageUrl
      ).pathname
      await knowledgeBaseLink.click()

      const detail = page.getByTestId('knowledge-base-detail')
      await expect(detail.getByRole('heading', { level: 1 })).toContainText(
        kbName
      )
      await expect(page.getByTestId('kb-metrics')).toBeVisible()

      const chatbotSettings = page.getByTestId('kb-chatbot-settings')
      const graphSettings = page.getByTestId('kb-graph-settings')
      await expect(chatbotSettings).not.toHaveAttribute('open')
      await expect(graphSettings).not.toHaveAttribute('open')
      await expect(
        chatbotSettings.getByText(/Configure|Konfigurieren/)
      ).toBeVisible()
      await expect(
        graphSettings.getByText(/Configure|Konfigurieren/)
      ).toBeVisible()

      await page.getByTestId('add-kb-resource').focus()
      await page.getByTestId('add-kb-resource').click()
      const modal = page.getByTestId('kb-add-resource-modal')
      await expect(modal).toHaveRole('dialog')
      await expect(modal).toHaveAttribute(
        'aria-describedby',
        'kb-add-resource-description'
      )
      await expect(modal.locator('#kb-add-resource-description')).toBeVisible()
      await expect(page.getByTestId('choose-kb-resource-video')).toBeDisabled()
      await expect(page.getByTestId('choose-kb-resource-website')).toBeFocused()

      const modalButtons = modal.getByRole('button')
      const lastModalButton = modalButtons.last()
      await page.getByTestId('choose-kb-resource-website').press('Shift+Tab')
      await expect(lastModalButton).toBeFocused()
      await lastModalButton.press('Tab')
      await expect(page.getByTestId('choose-kb-resource-website')).toBeFocused()

      await page.getByTestId('choose-kb-resource-website').click()
      await expect(page.getByTestId('kb-url-title')).toBeFocused()
      await page.getByTestId('back-kb-add-resource').click()
      await expect(page.getByTestId('choose-kb-resource-website')).toBeFocused()
      await page.getByTestId('close-kb-add-resource-modal').click()
      await expect(modal).toBeHidden()
      await expect(page.getByTestId('add-kb-resource')).toBeFocused()

      let releasePendingUpload = () => {}
      let signalUploadStarted = () => {}
      let failNextKbMetricsRefresh = false
      let bulkIngestCalls = 0
      let replaceCalls = 0
      let syntheticFileVisible = false
      let syntheticFileReplaced = false
      // Synthetic imported inventory: a video-derived source without any
      // stored file, a link source with a safe original URL and an unknown
      // ingestion time, a document source, and a document with a signed
      // query in its stored URL. The second page is served only after the
      // bounded inventory cursor is used.
      const importedObservedAt = new Date(
        Date.UTC(2026, 7, 2, 9, 0)
      ).toISOString()
      const importedIngestedAt = new Date(
        Date.UTC(2026, 6, 18, 14, 30)
      ).toISOString()
      const importedVideoSource = {
        id: 'imported-video-source',
        sourceType: 'video',
        title: 'Synthetic lecture recording',
        sourceUrl: null,
        ingestedAt: importedIngestedAt,
        observedAt: importedObservedAt,
        chunkCount: 12,
      }
      const importedLinkSource = {
        id: 'imported-link-source',
        sourceType: 'link',
        title: 'Synthetic reading list',
        sourceUrl: 'https://example.org/synthetic-reading-list',
        ingestedAt: null,
        observedAt: importedObservedAt,
        chunkCount: 3,
      }
      const importedDocumentSource = {
        id: 'imported-document-source',
        sourceType: 'document',
        title: 'Synthetic handbook',
        sourceUrl: null,
        ingestedAt: importedIngestedAt,
        observedAt: importedObservedAt,
        chunkCount: 7,
      }
      // A stored value that carries credentials, a query or a fragment is
      // rejected by registration and must never render as a link.
      const importedSignedSource = {
        id: 'imported-signed-source',
        sourceType: 'document',
        title: 'Synthetic signed handbook',
        sourceUrl:
          'https://example.org/synthetic-handbook.pdf?sv=2025-11-05&sig=secret',
        ingestedAt: importedIngestedAt,
        observedAt: importedObservedAt,
        chunkCount: 2,
      }
      const pendingUpload = new Promise<void>((resolve) => {
        releasePendingUpload = resolve
      })
      const uploadStarted = new Promise<void>((resolve) => {
        signalUploadStarted = resolve
      })

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

      await page.route('**/graphql*', async (route) => {
        const request = route.request()
        const requestUrl = new URL(request.url())
        let operationName =
          requestUrl.searchParams.get('operationName') ?? undefined

        if (!operationName && request.method() === 'POST') {
          operationName = (request.postDataJSON() as { operationName?: string })
            .operationName
        }
        if (!operationName) {
          const extensions = requestUrl.searchParams.get('extensions')
          const hash = extensions
            ? (
                JSON.parse(extensions) as {
                  persistedQuery?: { sha256Hash?: string }
                }
              ).persistedQuery?.sha256Hash
            : undefined
          operationName = hash ? persistedNames[hash] : undefined
        }
        if (operationName === 'GetKbImportedSources') {
          if (importedSourceMode === 'error') {
            await route.fulfill({
              status: 500,
              contentType: 'application/json',
              body: JSON.stringify({
                errors: [{ message: 'synthetic inventory failure' }],
              }),
            })
            return
          }
          if (importedSourceMode === 'empty') {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                data: {
                  getKbImportedSources: {
                    items: [],
                    pageInfo: { hasNextPage: false, endCursor: null },
                    totalSourcesInScan: 0,
                    incomplete: false,
                    unidentifiedChunks: 0,
                  },
                },
              }),
            })
            return
          }
          const variables = (() => {
            try {
              return (
                (
                  request.postDataJSON() as {
                    variables?: { after?: unknown }
                  }
                ).variables ?? {}
              )
            } catch {
              return {}
            }
          })()
          const after =
            typeof variables.after === 'string' ? variables.after : null
          const incomplete = importedSourceMode === 'incomplete'
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                getKbImportedSources: after
                  ? {
                      items: [
                        importedLinkSource,
                        importedDocumentSource,
                        importedSignedSource,
                      ],
                      pageInfo: { hasNextPage: false, endCursor: null },
                      totalSourcesInScan: 4,
                      incomplete: false,
                      unidentifiedChunks: 0,
                    }
                  : {
                      items: [importedVideoSource],
                      pageInfo: incomplete
                        ? { hasNextPage: false, endCursor: null }
                        : {
                            hasNextPage: true,
                            endCursor: 'synthetic-imported-page-2',
                          },
                      totalSourcesInScan: incomplete ? 5000 : 4,
                      incomplete,
                      unidentifiedChunks: incomplete ? 2 : 0,
                    },
              },
            }),
          })
          return
        }
        if (operationName === 'RequestKbFileUpload') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                requestKbFileUpload: {
                  uploadSasURL: 'https://kb-upload.invalid/?sig=test',
                  containerName: 'kb',
                  blobName: 'pending.txt',
                },
              },
            }),
          })
          return
        }
        if (operationName === 'ConfirmKbFileUpload') {
          syntheticFileVisible = true
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: { confirmKbFileUpload: { id: 'synthetic-resource' } },
            }),
          })
          return
        }
        if (operationName === 'RequestKbFileReplacement') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                requestKbFileReplacement: {
                  uploadSasURL: 'https://kb-upload.invalid/?sig=test',
                  containerName: 'kb',
                  blobName: 'replacement.txt',
                },
              },
            }),
          })
          return
        }
        if (operationName === 'ConfirmKbFileReplacement') {
          replaceCalls += 1
          syntheticFileReplaced = true
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                confirmKbFileReplacement: {
                  id: 'synthetic-resource',
                  status: 'QUEUED',
                  resourceVersion: 2,
                  activeResourceVersion: 1,
                },
              },
            }),
          })
          return
        }

        if (operationName === 'GetKbResources' && syntheticFileVisible) {
          const response = await route.fetch()
          const body = (await response.json()) as {
            data?: {
              getKbResources?: {
                items: Array<Record<string, unknown> & { id: string }>
                totalCount: number
                inProgressCount: number
              }
            }
          }
          const connection = body.data?.getKbResources
          if (connection) {
            connection.items = [
              {
                id: 'synthetic-resource',
                type: 'BLOB',
                materialType: 'COURSE_CONTENT',
                title: 'pending.txt',
                sourceUrl: null,
                originalFilename: syntheticFileReplaced
                  ? 'replaced.txt'
                  : 'pending.txt',
                mimeType: 'text/plain',
                sizeBytes: syntheticFileReplaced ? 16 : 14,
                status: syntheticFileReplaced ? 'QUEUED' : 'READY',
                ingestedAt: new Date(0).toISOString(),
                resourceVersion: syntheticFileReplaced ? 2 : 1,
                activeResourceVersion: 1,
                latestIngestionRun: syntheticFileReplaced
                  ? {
                      id: 'replacement-attempt',
                      status: 'QUEUED',
                      errorCode: null,
                    }
                  : null,
                createdAt: new Date(0).toISOString(),
                updatedAt: new Date(0).toISOString(),
              },
              ...connection.items.filter(
                ({ id }) => id !== 'synthetic-resource'
              ),
            ]
            connection.totalCount += 1
            if (syntheticFileReplaced) connection.inProgressCount += 1
          }
          await route.fulfill({ response, json: body })
          return
        }
        if (operationName === 'IngestAllKbResources') {
          bulkIngestCalls += 1
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                ingestAllKbResources: {
                  queuedCount: 1,
                  retriedFailedCount: 0,
                  alreadyCurrentCount: 0,
                  alreadyInProgressCount: 0,
                  queueFailureCount: 0,
                },
              },
            }),
          })
          return
        }

        if (operationName === 'GetKb' && failNextKbMetricsRefresh) {
          failNextKbMetricsRefresh = false
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              errors: [{ message: 'Synthetic metrics refresh failure' }],
            }),
          })
          return
        }

        await route.continue()
      })
      await page.route('https://kb-upload.invalid/**', async (route) => {
        if (route.request().method() === 'OPTIONS') {
          await route.fulfill({
            status: 204,
            headers: {
              'access-control-allow-headers': '*',
              'access-control-allow-methods': 'PUT, OPTIONS',
              'access-control-allow-origin': '*',
            },
          })
          return
        }

        signalUploadStarted()
        await pendingUpload
        await route.fulfill({
          status: 201,
          headers: {
            'access-control-allow-origin': '*',
            etag: '"synthetic-etag"',
            'last-modified': new Date(0).toUTCString(),
            'x-ms-request-id': 'synthetic-request',
            'x-ms-version': '2025-11-05',
          },
        })
      })

      await page.getByTestId('add-kb-resource').click()
      await page.getByTestId('choose-kb-resource-document').click()
      await page.getByTestId('kb-file-input').setInputFiles({
        name: 'pending.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('pending upload'),
      })
      await uploadStarted
      await expect(page.getByTestId('close-kb-add-resource-modal')).toHaveCount(
        0
      )
      await expect(page.getByTestId('back-kb-add-resource')).toHaveCount(0)
      await page.keyboard.press('Escape')
      await expect(modal).toBeVisible()

      releasePendingUpload()
      await expect(modal).toBeHidden()

      await page.getByTestId('add-kb-resource').click()
      await page.getByTestId('choose-kb-resource-website').click()
      await page.getByTestId('kb-url-title').fill(resourceTitle)
      await page
        .getByTestId('kb-url')
        .fill(`https://example.org/${resourceTitle.replaceAll(' ', '-')}`)
      await selectOption(
        page,
        '[data-cy="kb-url-material-type"]',
        'Administrative'
      )
      failNextKbMetricsRefresh = true
      await page.getByTestId('add-kb-url-resource').click()
      await expect(modal).toBeHidden()
      await page.reload()
      await expect(detail).toBeVisible()

      const resourceTable = page.getByRole('table')
      await expect(resourceTable).toBeVisible()
      await expect(
        resourceTable.getByRole('columnheader', { name: /Resource|Ressource/ })
      ).toBeVisible()
      await expect(
        resourceTable.getByRole('columnheader', {
          name: /Latest ingestion|Letzte Verarbeitung/,
        })
      ).toBeVisible()
      await expect(
        resourceTable.getByRole('columnheader', {
          name: /Material category|Materialkategorie/,
        })
      ).toBeVisible()
      const resourceRow = resourceTable.getByRole('row').filter({
        hasText: resourceTitle,
      })
      await expect(resourceRow).toBeVisible()
      await expect(resourceRow).toContainText(/Administrative/)
      await expect(
        resourceRow.locator('[data-cy^="kb-resource-status-"]')
      ).toContainText(/Added|Hinzugefügt/)
      await expect(page.getByTestId('kb-ingestion-summary')).toContainText(
        /1 need ingestion/
      )
      await expect(page.getByTestId('ingest-all-kb-resources')).toBeVisible()
      await selectOption(
        page,
        '[data-cy="kb-resource-material-type-filter"]',
        'Administrative'
      )
      await expect(resourceRow).toBeVisible()
      await selectOption(
        page,
        '[data-cy="kb-resource-material-type-filter"]',
        'All'
      )
      await page.getByTestId('ingest-all-kb-resources').click()
      const ingestAllModal = page.getByTestId('ingest-all-kb-resources-modal')
      await expect(ingestAllModal).toBeVisible()
      await expect(ingestAllModal).toContainText('1 resource')
      await ingestAllModal
        .getByTestId('confirm-ingest-all-kb-resources')
        .click()
      await expect(ingestAllModal).toBeHidden()
      expect(bulkIngestCalls).toBe(1)
      await resourceRow.getByTestId(/inspect-kb-resource-/).click()
      await expect(page.getByTestId('kb-resource-inspector')).toBeVisible()
      await expect(
        page.getByTestId('kb-inspector-material-type')
      ).toContainText('Administrative')
      await expect(
        page.getByTestId('ingest-kb-resource-inspector')
      ).toContainText(/Ingest|Verarbeiten/)
      await page.getByTestId('done-kb-resource-inspector').click()

      await resourceRow.getByTestId(/kb-resource-actions-/).click()
      await expect(page.getByTestId(/replace-kb-resource-/)).toHaveCount(0)
      await page.keyboard.press('Escape')

      const fileRow = resourceTable.getByRole('row').filter({
        hasText: 'pending.txt',
      })
      await fileRow.getByTestId(/kb-resource-actions-/).click()
      await page.getByTestId('replace-kb-resource-synthetic-resource').click()
      const replaceModal = page.getByTestId('kb-replace-file-modal')
      await expect(replaceModal).toBeVisible()
      await expect(replaceModal).toContainText(
        /Choose a new file|Wählen Sie eine neue Datei/
      )
      await page.getByTestId('kb-file-input').setInputFiles({
        name: 'replaced.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('replaced content'),
      })
      await expect(
        page.getByTestId('confirm-kb-file-replacement')
      ).toBeVisible()
      failNextKbMetricsRefresh = true
      await page.getByTestId('confirm-kb-file-replacement').click()
      await expect(replaceModal).toBeHidden()
      expect(replaceCalls).toBe(1)
      await page.reload()
      await expect(detail).toBeVisible()
      await expect(fileRow).toContainText(/Version 1 remains|Version 1 bleibt/)

      const importedSection = page.getByTestId('kb-imported-sources')
      await expect(importedSection).toBeVisible()
      await expect(page.getByTestId('kb-imported-sources-notice')).toBeVisible()

      const importedVideoRow = page.getByTestId(
        'kb-imported-source-imported-video-source'
      )
      await expect(importedVideoRow).toContainText(
        'Synthetic lecture recording'
      )
      await expect(
        page.getByTestId('kb-imported-source-type-imported-video-source')
      ).toContainText('Video')
      // A video-derived source is listed without any stored file or link.
      await expect(
        page.getByTestId('kb-imported-source-video-hint-imported-video-source')
      ).toBeVisible()
      await expect(importedVideoRow.locator('a')).toHaveCount(0)
      await expect(
        page.getByTestId('kb-imported-source-ingested-imported-video-source')
      ).toBeVisible()

      // The bounded inventory loads its next page on demand.
      await page.getByTestId('load-more-imported-sources').click()
      await expect(
        page.getByTestId('kb-imported-source-imported-link-source')
      ).toBeVisible()
      await expect(importedSection.locator('li')).toHaveCount(4)
      await expect(
        page.getByTestId('kb-imported-source-link-imported-link-source')
      ).toHaveAttribute('href', 'https://example.org/synthetic-reading-list')
      // An unrecorded ingestion time stays honestly unknown.
      await expect(
        page.getByTestId('kb-imported-source-ingested-imported-link-source')
      ).toContainText(/not recorded|nicht erfasst/)
      // A stored URL with credentials, query or fragment stays unlinked.
      const importedSignedRow = page.getByTestId(
        'kb-imported-source-imported-signed-source'
      )
      await expect(importedSignedRow).toContainText('Synthetic signed handbook')
      await expect(importedSignedRow.locator('a')).toHaveCount(0)
      // The inventory is read-only: no ingestion, retry or deletion controls.
      await expect(importedSection.getByRole('button')).toHaveCount(0)

      await page.setViewportSize({ width: 1440, height: 900 })
      await page.screenshot({
        path: testInfo.outputPath('kb-management-en-desktop.png'),
        fullPage: true,
      })

      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(`${manageUrl}/de${detailPath}`)
      await expect(page.getByTestId('knowledge-base-detail')).toBeVisible()
      await expect(page.getByTestId('add-kb-resource')).toContainText(
        'Ressource hinzufügen'
      )
      await expect(
        page.getByTestId('kb-chatbot-settings').getByText('Konfigurieren')
      ).toBeVisible()
      await page.getByTestId('kb-imported-sources').scrollIntoViewIfNeeded()
      await page.screenshot({
        path: testInfo.outputPath('kb-management-de-desktop.png'),
        fullPage: true,
      })

      await page.setViewportSize({ width: 375, height: 812 })
      await expect(page.getByTestId('kb-imported-sources')).toBeVisible()
      await page.screenshot({
        path: testInfo.outputPath('kb-management-de-mobile.png'),
        fullPage: true,
      })

      await page.goto(`${manageUrl}${detailPath}`)
      await expect(page.getByTestId('kb-imported-sources')).toBeVisible()
      await page.screenshot({
        path: testInfo.outputPath('kb-management-en-mobile.png'),
        fullPage: true,
      })

      // The inventory renders its empty and failed initial-load branches.
      importedSourceMode = 'empty'
      await page.goto(`${manageUrl}${detailPath}`)
      await expect(page.getByTestId('kb-imported-sources')).toBeVisible()
      await expect(page.getByTestId('kb-imported-sources-empty')).toBeVisible()

      importedSourceMode = 'error'
      await page.goto(`${manageUrl}${detailPath}`)
      await expect(page.getByTestId('kb-imported-sources')).toBeVisible()
      await expect(page.getByTestId('kb-imported-sources-error')).toBeVisible()

      // A truncated scan window is surfaced instead of a fake total.
      importedSourceMode = 'incomplete'
      await page.goto(`${manageUrl}${detailPath}`)
      await expect(page.getByTestId('kb-imported-sources')).toBeVisible()
      await expect(
        page.getByTestId('kb-imported-sources-incomplete')
      ).toBeVisible()
      importedSourceMode = 'data'
    } finally {
      importedSourceMode = 'data'
      if (detailPath) {
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.goto(`${manageUrl}${detailPath}`)
        const resourceRow = page
          .getByRole('table')
          .getByRole('row')
          .filter({ hasText: resourceTitle })
        if (await resourceRow.count()) {
          await resourceRow.getByTestId(/kb-resource-actions-/).click()
          await page.getByTestId(/delete-kb-resource-/).click()
          await page.getByTestId('confirm-delete-kb-resource').click()
          await expect(resourceRow).toHaveCount(0)
        }

        await page.goto(`${manageUrl}/resources/knowledgeBases`)
        const knowledgeBaseRow = page.locator('li').filter({ hasText: kbName })
        if (await knowledgeBaseRow.count()) {
          await knowledgeBaseRow
            .getByRole('button', { name: /Delete|Löschen/ })
            .click()
          await page.getByTestId('confirm-delete-knowledge-base').click()
          await expect(knowledgeBaseRow).toHaveCount(0)
        }
      }
    }
  })
})
