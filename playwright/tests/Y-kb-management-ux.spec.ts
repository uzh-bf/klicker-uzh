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
      const pendingUpload = new Promise<void>((resolve) => {
        releasePendingUpload = resolve
      })
      const uploadStarted = new Promise<void>((resolve) => {
        signalUploadStarted = resolve
      })

      await page.route('**/graphql', async (route) => {
        const request = route.request()
        if (request.method() !== 'POST') {
          await route.continue()
          return
        }

        const operationName = (
          request.postDataJSON() as { operationName?: string }
        ).operationName
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
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: { confirmKbFileUpload: { id: 'synthetic-resource' } },
            }),
          })
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
      await page.screenshot({
        path: testInfo.outputPath('kb-management-de-desktop.png'),
        fullPage: true,
      })
    } finally {
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
