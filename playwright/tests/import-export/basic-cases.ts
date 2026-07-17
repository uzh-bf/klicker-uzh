import { AxeBuilder } from '@axe-core/playwright'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { getPrisma } from '../../global-setup.js'
import { URL_MANAGE } from '../../util/constants.js'
import {
  createQuestionSC,
  validateElement,
} from '../../util/fixtures/elements.js'
import { getImportExportConcurrencyLeaseCleanupKeys } from '../../util/fixtures/importExportArtifacts.js'
import { isGraphqlOperation } from '../../util/graphqlRequest.js'
import { enMessages as messages } from '../../util/messages.js'
import { expect, importExportTest } from './fixture.js'
import {
  expectAllowedUploadCors,
  expectNoStore,
  expectNoUploadCors,
  getElementsSearchInput,
  getLookalikeOrigin,
  getManageOrigin,
  importUploadCapabilityHeader,
  openExportPackageModal,
  openImportPackageModal,
  prepareImportPackageUpload,
  seedPackageElements,
  uploadPackageFile,
} from './support.js'

export function registerBasicImportExportCases() {
  importExportTest(
    'Download action is disabled until at least one element is selected',
    async ({ page }) => {
      await expect(page.getByTestId('elements-download')).toBeDisabled()
      await expect(
        page.getByTestId('download-selected-elements-package')
      ).not.toBeAttached()
    }
  )

  importExportTest(
    'Import upload HTTP boundary enforces strict CORS, authentication, MIME, exact bytes, and READY replay',
    async ({
      importExportIsolation,
      page,
      playwright,
      trackImportExportArtifact,
    }) => {
      const manageOrigin = getManageOrigin()
      const lookalikeOrigin = getLookalikeOrigin(manageOrigin)
      const payload = Buffer.from('PK\u0003\u0004playwright package boundary')
      const expectedSha256 = createHash('sha256').update(payload).digest('hex')
      const upload = await prepareImportPackageUpload(
        page,
        payload.length,
        trackImportExportArtifact
      )
      const uploadHeaders = {
        'Content-Length': String(payload.length),
        'Content-Type': 'application/zip',
        [importUploadCapabilityHeader]: upload.uploadCapability,
      }

      await importExportTest.step(
        'isolated teardown covers upload concurrency leases',
        async () => {
          expect(
            getImportExportConcurrencyLeaseCleanupKeys(
              importExportIsolation.users.owner.id
            )
          ).toContainEqual({
            operation: 'upload',
            userKey: `concurrency:{import-export-package}:upload:user:${importExportIsolation.users.owner.id}`,
            globalKey: 'concurrency:{import-export-package}:upload:global',
          })
        }
      )

      await importExportTest.step(
        'preflight exposes CORS only to the exact manage origin',
        async () => {
          const allowed = await page.request.fetch(upload.uploadURL, {
            method: 'OPTIONS',
            headers: {
              Origin: manageOrigin,
              'Access-Control-Request-Method': 'PUT',
              'Access-Control-Request-Headers': `Content-Type, ${importUploadCapabilityHeader}`,
            },
          })

          expect(allowed.status()).toBe(204)
          expectNoStore(allowed)
          expectAllowedUploadCors(allowed, manageOrigin)
          const allowedHeaders = allowed.headers()
          expect(allowedHeaders['access-control-allow-methods']).toBe('PUT')
          expect(
            allowedHeaders['access-control-allow-headers']
              ?.toLowerCase()
              .split(/,\s*/)
              .sort()
          ).toEqual(['content-type', importUploadCapabilityHeader].sort())
          expect(allowedHeaders.vary).toContain('Origin')

          const denied = await page.request.fetch(upload.uploadURL, {
            method: 'OPTIONS',
            headers: {
              Origin: lookalikeOrigin,
              'Access-Control-Request-Method': 'PUT',
              'Access-Control-Request-Headers': `Content-Type, ${importUploadCapabilityHeader}`,
            },
          })

          expect(denied.status()).toBe(403)
          expectNoStore(denied)
          expectNoUploadCors(denied)
        }
      )

      await importExportTest.step(
        'authenticated upload rejects a lookalike origin without CORS disclosure',
        async () => {
          const response = await page.request.put(upload.uploadURL, {
            headers: { ...uploadHeaders, Origin: lookalikeOrigin },
            data: payload,
          })

          expect(response.status()).toBe(403)
          expectNoStore(response)
          expectNoUploadCors(response)
          expect(response.headers()['content-type']).toContain(
            'application/json'
          )
          await expect(response.json()).resolves.toEqual({
            code: 'IMPORT_TOKEN_INVALID',
          })
        }
      )

      await importExportTest.step(
        'upload requires an authenticated session',
        async () => {
          const unauthenticated = await playwright.request.newContext({
            ignoreHTTPSErrors: true,
          })

          try {
            const response = await unauthenticated.put(upload.uploadURL, {
              headers: { ...uploadHeaders, Origin: manageOrigin },
              data: payload,
            })

            expect(response.status()).toBe(401)
            expectNoStore(response)
            expectAllowedUploadCors(response, manageOrigin)
            expect(response.headers()['content-type']).toContain(
              'application/json'
            )
            await expect(response.json()).resolves.toEqual({
              code: 'IMPORT_TOKEN_INVALID',
            })
          } finally {
            await unauthenticated.dispose()
          }
        }
      )

      await importExportTest.step(
        'authenticated upload rejects a non-ZIP MIME type with a stable code',
        async () => {
          const response = await page.request.put(upload.uploadURL, {
            headers: {
              ...uploadHeaders,
              'Content-Type': 'text/plain',
              Origin: manageOrigin,
            },
            data: payload,
          })

          expect(response.status()).toBe(415)
          expectNoStore(response)
          expectAllowedUploadCors(response, manageOrigin)
          expect(response.headers()['content-type']).toContain(
            'application/json'
          )
          await expect(response.json()).resolves.toEqual({
            code: 'IMPORT_UNSUPPORTED_FILE_TYPE',
          })
        }
      )

      await importExportTest.step(
        'exact upload succeeds and READY replay is idempotent',
        async () => {
          const first = await page.request.put(upload.uploadURL, {
            headers: { ...uploadHeaders, Origin: manageOrigin },
            data: payload,
          })

          expect(first.status()).toBe(201)
          expectNoStore(first)
          expectAllowedUploadCors(first, manageOrigin)
          expect(first.headers()['content-type']).toContain('application/json')
          await expect(first.json()).resolves.toEqual({
            bytes: payload.length,
            sha256: expectedSha256,
            replayed: false,
          })

          const replay = await page.request.put(upload.uploadURL, {
            headers: { ...uploadHeaders, Origin: manageOrigin },
            data: payload,
          })

          expect(replay.status()).toBe(201)
          expectNoStore(replay)
          expectAllowedUploadCors(replay, manageOrigin)
          expect(replay.headers()['content-type']).toContain('application/json')
          await expect(replay.json()).resolves.toEqual({
            bytes: payload.length,
            sha256: expectedSha256,
            replayed: true,
          })
        }
      )
    }
  )

  importExportTest(
    'Local imported-media route survives receipt-history cleanup',
    async ({ importExportIsolation, page }) => {
      const prisma = await getPrisma()
      const ownerId = importExportIsolation.users.owner.id
      const mediaId = randomUUID()
      const filename = `${mediaId}.png`
      const storageBlob = `imported/${filename}`
      const receiptId = randomUUID()
      const apiOrigin = process.env.APP_ORIGIN_API ?? 'http://127.0.0.1:3000'
      const href = `${apiOrigin.replace(/\/$/, '')}/api/import-export-media/${ownerId}/${filename}`
      const packageRoot =
        process.env.LOCAL_IMPORT_EXPORT_PACKAGE_DIR ??
        path.join(tmpdir(), 'klicker-import-export-packages')
      const mediaPath = path.join(
        packageRoot,
        'imported-media',
        ownerId,
        storageBlob
      )
      const bytes = Buffer.from('playwright-local-imported-media')

      await mkdir(path.dirname(mediaPath), { recursive: true })
      await writeFile(mediaPath, bytes)
      await prisma.mediaFile.create({
        data: {
          id: mediaId,
          ownerId,
          href,
          name: filename,
          type: 'image/png',
          originalId: `playwright-import-media:${mediaId}`,
          contentHash: createHash('sha256').update(bytes).digest('hex'),
          importFingerprintVersion: 1,
        },
      })
      const importedElement = await prisma.element.create({
        data: {
          type: 'CONTENT',
          name: `Playwright imported media ${mediaId}`,
          content: 'Imported media lifecycle fixture',
          options: {},
          status: 'REVIEW',
          originalId: 'playwright-element',
          ownerId,
        },
      })
      const completedAt = new Date()
      await prisma.elementImportReceipt.create({
        data: {
          id: receiptId,
          jti: randomUUID(),
          sourceArtifactId: randomUUID(),
          packageHash: createHash('sha256').update('package').digest('hex'),
          selectionDigest: createHash('sha256')
            .update('selection')
            .digest('hex'),
          selectedElementRefs: ['playwright-element'],
          state: 'COMPLETE',
          createdElementIds: [importedElement.id],
          createdAnswerCollectionIds: [],
          completedAt,
          retentionExpiresAt: new Date(
            completedAt.getTime() + 24 * 60 * 60 * 1000
          ),
          ownerId,
        },
      })
      await prisma.importMediaStaging.create({
        data: {
          operationId: randomUUID(),
          packageMediaRef: `media-${mediaId}`,
          contentHash: createHash('sha256').update(bytes).digest('hex'),
          storageContainer: ownerId,
          storageBlob,
          state: 'FINALIZED',
          createdBlob: true,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          receiptId,
          ownerId,
          mediaFileId: mediaId,
        },
      })

      const response = await page.request.get(href)
      expect(response.status()).toBe(200)
      expect(response.headers()['cache-control']).toBe('no-store')
      expect(response.headers()['x-content-type-options']).toBe('nosniff')
      expect(response.headers()['content-type']).toContain('image/png')
      expect(await response.body()).toEqual(bytes)

      const otherOwner = '00000000-0000-4000-8000-000000000001'
      const wrongOwner = await page.request.get(
        `${apiOrigin.replace(/\/$/, '')}/api/import-export-media/${otherOwner}/${filename}`
      )
      expect(wrongOwner.status()).toBe(404)

      await prisma.importMediaStaging.deleteMany({ where: { receiptId } })
      await prisma.elementImportReceipt.deleteMany({
        where: { id: receiptId },
      })
      const afterReceiptHistoryCleanup = await page.request.get(href)
      expect(afterReceiptHistoryCleanup.status()).toBe(200)
      expect(await afterReceiptHistoryCleanup.body()).toEqual(bytes)
    }
  )

  importExportTest(
    'Owner can export selected elements as a ZIP package',
    async ({ importExportIsolation, page }, testInfo) => {
      const names = await seedPackageElements({
        page,
        suffix: `export ${testInfo.workerIndex}`,
        userId: importExportIsolation.users.owner.id,
      })

      await openExportPackageModal(page, [names.singleChoice, names.selection])
      await expect(
        page.getByTestId('element-export-answer-collections-overview')
      ).toBeVisible()
      await expect(
        page.getByTestId('element-package-answer-collection-0')
      ).toContainText(names.collection)
      await expect(
        page.getByTestId('download-selected-elements-package')
      ).toBeEnabled()
      const accessibility = await new AxeBuilder({ page })
        .include('[data-cy="element-download-modal"]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
      expect(
        accessibility.violations,
        JSON.stringify(
          accessibility.violations.map((violation) => ({
            id: violation.id,
            impact: violation.impact,
            targets: violation.nodes.map((node) => node.target),
          })),
          null,
          2
        )
      ).toEqual([])
      const packageLinkRequests: string[] = []
      page.on('request', (request) => {
        if (isGraphqlOperation(request, 'GetElementExportPackageLink')) {
          packageLinkRequests.push(request.url())
        }
      })
      let releaseFirstPackageLink!: () => void
      const firstPackageLinkGate = new Promise<void>((resolve) => {
        releaseFirstPackageLink = resolve
      })
      let releaseFirstPackageDownload!: () => void
      const firstPackageDownloadGate = new Promise<void>((resolve) => {
        releaseFirstPackageDownload = resolve
      })
      await page.route('**/api/graphql*', async (route) => {
        if (
          isGraphqlOperation(route.request(), 'GetElementExportPackageLink')
        ) {
          await firstPackageLinkGate
        }
        await route.continue()
      })
      await page.route(
        '**/api/import-export-packages/*/download*',
        async (route) => {
          await firstPackageDownloadGate
          await route.continue()
        }
      )
      try {
        const downloadPromise = page.waitForEvent('download')
        void downloadPromise.catch(() => undefined)
        const firstPackageRequest = page.waitForRequest((request) =>
          isGraphqlOperation(request, 'GetElementExportPackageLink')
        )
        void firstPackageRequest.catch(() => undefined)
        const firstPackageDownloadRequest = page.waitForRequest(
          (request) =>
            request.url().includes('/api/import-export-packages/') &&
            request.url().includes('/download')
        )
        void firstPackageDownloadRequest.catch(() => undefined)
        await page.getByTestId('download-selected-elements-package').click()
        await firstPackageRequest
        try {
          await expect(
            page.getByTestId('download-selected-elements-package')
          ).toHaveAttribute('aria-busy', 'true')
          await expect(
            page.getByTestId('element-export-download-status')
          ).toContainText(messages.manage.elements.packageDownloadPreparing)
        } finally {
          releaseFirstPackageLink()
        }
        await firstPackageDownloadRequest
        try {
          await expect(
            page.getByTestId('download-selected-elements-package')
          ).toHaveAttribute('aria-busy', 'true')
          await expect(
            page.getByTestId('element-export-download-status')
          ).toContainText(messages.manage.elements.packageDownloadPreparing)
        } finally {
          releaseFirstPackageDownload()
        }
        const download = await downloadPromise

        expect(download.suggestedFilename()).toMatch(/\.zip$/)

        const secondPackageRequest = page.waitForRequest((request) =>
          isGraphqlOperation(request, 'GetElementExportPackageLink')
        )
        void secondPackageRequest.catch(() => undefined)
        const secondDownload = page.waitForEvent('download')
        void secondDownload.catch(() => undefined)
        await page.getByTestId('download-selected-elements-package').click()
        await secondPackageRequest
        expect((await secondDownload).suggestedFilename()).toMatch(/\.zip$/)
        expect(packageLinkRequests).toHaveLength(2)
      } finally {
        releaseFirstPackageLink()
        releaseFirstPackageDownload()
      }
    }
  )

  importExportTest(
    'Closing the export modal cancels an active package download request',
    async ({ importExportIsolation, page }, testInfo) => {
      const names = await seedPackageElements({
        page,
        suffix: `cancel export ${testInfo.workerIndex}`,
        userId: importExportIsolation.users.owner.id,
      })
      const lateDownloadUrl = new URL(
        '/fake-late-export-package.zip',
        process.env.URL_MANAGE ?? URL_MANAGE
      ).toString()
      let releasePackageLink!: () => void
      let packageLinkStarted!: () => void
      let packageLinkRouteSettled!: () => void
      const packageLinkGate = new Promise<void>((resolve) => {
        releasePackageLink = resolve
      })
      const packageLinkRequest = new Promise<void>((resolve) => {
        packageLinkStarted = resolve
      })
      const packageLinkSettled = new Promise<void>((resolve) => {
        packageLinkRouteSettled = resolve
      })

      await page.route('**/api/graphql*', async (route) => {
        if (
          !isGraphqlOperation(route.request(), 'GetElementExportPackageLink')
        ) {
          await route.continue()
          return
        }

        importExportIsolation.markRequestAbortedBeforeServer(route.request())
        packageLinkStarted()
        await packageLinkGate
        try {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                getElementExportPackageLink: {
                  downloadLink: lateDownloadUrl,
                  filename: 'late-export.zip',
                },
              },
            }),
          })
        } catch {
          // Closing the modal aborts the request before this delayed response
          // can be delivered.
        } finally {
          packageLinkRouteSettled()
        }
      })

      try {
        await openExportPackageModal(page, [names.singleChoice])
        await page.getByTestId('download-selected-elements-package').click()
        await packageLinkRequest

        const requestFailure = page.waitForEvent('requestfailed', {
          timeout: 30_000,
          predicate: (request) =>
            isGraphqlOperation(request, 'GetElementExportPackageLink'),
        })
        void requestFailure.catch(() => undefined)
        const requestFinished = page.waitForEvent('requestfinished', {
          timeout: 30_000,
          predicate: (request) =>
            isGraphqlOperation(request, 'GetElementExportPackageLink'),
        })
        void requestFinished.catch(() => undefined)
        const requestSettlement = Promise.race([
          requestFailure.then(() => 'failed' as const),
          requestFinished.then(() => 'finished' as const),
        ])
        void requestSettlement.catch(() => undefined)

        await page.getByTestId('close-element-download-modal').click()
        await expect(
          page.getByTestId('element-download-modal')
        ).not.toBeAttached()
        releasePackageLink()
        await packageLinkSettled
        expect(await requestSettlement).toBe('failed')
        await expect(
          page
            .getByLabel('Notifications alt+T')
            .getByText(messages.manage.elements.elementDownloadFailed)
        ).toHaveCount(0)
      } finally {
        releasePackageLink()
      }
    }
  )

  importExportTest(
    'Closing the export modal cancels an active package transfer before download',
    async ({ importExportIsolation, page }, testInfo) => {
      const names = await seedPackageElements({
        page,
        suffix: `cancel export transfer ${testInfo.workerIndex}`,
        userId: importExportIsolation.users.owner.id,
      })
      const heldDownloadUrl = new URL(
        '/fake-held-export-package.zip',
        process.env.URL_MANAGE ?? URL_MANAGE
      ).toString()
      let releaseTransfer!: () => void
      let transferStarted!: () => void
      let transferRouteSettled!: () => void
      const transferGate = new Promise<void>((resolve) => {
        releaseTransfer = resolve
      })
      const transferRequest = new Promise<void>((resolve) => {
        transferStarted = resolve
      })
      const transferSettled = new Promise<void>((resolve) => {
        transferRouteSettled = resolve
      })

      await page.route('**/api/graphql*', async (route) => {
        if (
          !isGraphqlOperation(route.request(), 'GetElementExportPackageLink')
        ) {
          await route.continue()
          return
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              getElementExportPackageLink: {
                downloadLink: heldDownloadUrl,
                filename: 'held-export.zip',
              },
            },
          }),
        })
      })
      await page.route(heldDownloadUrl, async (route) => {
        transferStarted()
        await transferGate
        try {
          await route.fulfill({
            status: 200,
            contentType: 'application/zip',
            body: Buffer.from('late package bytes'),
          })
        } catch {
          // The modal unmount aborts the held blob fetch before it can trigger
          // the synthetic anchor download.
        } finally {
          transferRouteSettled()
        }
      })

      let downloadCount = 0
      const countDownload = () => {
        downloadCount += 1
      }
      page.on('download', countDownload)
      try {
        await openExportPackageModal(page, [names.singleChoice])
        await page.getByTestId('download-selected-elements-package').click()
        await transferRequest

        const requestFailure = page.waitForEvent('requestfailed', {
          timeout: 30_000,
          predicate: (request) => request.url() === heldDownloadUrl,
        })
        void requestFailure.catch(() => undefined)
        const requestFinished = page.waitForEvent('requestfinished', {
          timeout: 30_000,
          predicate: (request) => request.url() === heldDownloadUrl,
        })
        void requestFinished.catch(() => undefined)
        const requestSettlement = Promise.race([
          requestFailure.then(() => 'failed' as const),
          requestFinished.then(() => 'finished' as const),
        ])
        void requestSettlement.catch(() => undefined)

        await page.getByTestId('close-element-download-modal').click()
        await expect(
          page.getByTestId('element-download-modal')
        ).not.toBeAttached()
        releaseTransfer()
        await transferSettled
        expect(await requestSettlement).toBe('failed')
        await page.evaluate(
          () =>
            new Promise<void>((resolve) => {
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve())
              )
            })
        )
        expect(downloadCount).toBe(0)
        await expect(
          page
            .getByLabel('Notifications alt+T')
            .getByText(messages.manage.elements.elementDownloadFailed)
        ).toHaveCount(0)
      } finally {
        releaseTransfer()
        page.off('download', countDownload)
      }
    }
  )

  importExportTest(
    'Export preview warns about external auto-loading media without blocking download',
    async ({ importExportIsolation, page }, testInfo) => {
      testInfo.setTimeout(180_000)
      const elementName = `PW Package external media ${testInfo.workerIndex}`
      const externalUrls = new Set([
        `https://example.com/media-${testInfo.workerIndex}.png`,
        `https://example.com/explanation-${testInfo.workerIndex}.jpg`,
        `https://example.com/choice-${testInfo.workerIndex}.webp`,
      ])
      const requestedExternalUrls: string[] = []
      page.on('request', (request) => {
        if (externalUrls.has(request.url())) {
          requestedExternalUrls.push(request.url())
        }
      })

      await createQuestionSC({
        name: elementName,
        content: `External media package content ![image](https://example.com/media-${testInfo.workerIndex}.png) [ordinary link](https://example.com/media-${testInfo.workerIndex}.png)`,
        explanation: `External media explanation ![image](https://example.com/explanation-${testInfo.workerIndex}.jpg)`,
        choices: [
          {
            value: `Choice with ![image](https://example.com/choice-${testInfo.workerIndex}.webp)`,
            correct: true,
          },
          { value: 'Distractor', correct: false },
        ],
        userId: importExportIsolation.users.owner.id,
      })

      await page.goto(process.env.URL_MANAGE ?? URL_MANAGE, {
        waitUntil: 'commit',
      })
      await expect(getElementsSearchInput(page)).toBeVisible({
        timeout: 30_000,
      })
      await validateElement(page, elementName)

      await openExportPackageModal(page, [elementName])
      const packageWarning = page.getByTestId('element-export-package-warning')
      await expect(packageWarning).toContainText(
        messages.manage.elements.elementExportExternalMediaWarning
      )
      await expect(packageWarning).toHaveAttribute('role', 'status')
      await expect(packageWarning).toHaveAttribute('aria-live', 'polite')
      await expect(packageWarning).toHaveAttribute('aria-atomic', 'true')
      await expect(
        page.getByTestId('download-selected-elements-package')
      ).toBeEnabled()

      const downloadPromise = page.waitForEvent('download')
      await page.getByTestId('download-selected-elements-package').click()
      const download = await downloadPromise
      const zipPath = testInfo.outputPath(download.suggestedFilename())
      await download.saveAs(zipPath)
      await page.getByTestId('close-element-download-modal').click()

      await openImportPackageModal(page)
      await uploadPackageFile(page, zipPath)
      await expect(
        page.getByTestId('element-import-preview-panel')
      ).toBeVisible()
      await page.getByTestId('preview-imported-element-0').click()
      const preview = page.getByTestId('element-import-preview-content')
      await expect(preview).toContainText('⚠️')
      await expect(
        preview.getByRole('link', { name: 'ordinary link' })
      ).toHaveAttribute(
        'href',
        `https://example.com/media-${testInfo.workerIndex}.png`
      )
      expect(requestedExternalUrls).toEqual([])

      await page.getByTestId('confirm-element-import').click()
      await expect(
        page.getByTestId('element-import-preview-panel')
      ).not.toBeAttached({
        timeout: 30000,
      })
      expect(requestedExternalUrls).toEqual([])
    }
  )

  importExportTest(
    'Ordinary external links do not trigger media warnings',
    async ({ importExportIsolation, page }, testInfo) => {
      const elementName = `PW Package external link ${testInfo.workerIndex}`

      await createQuestionSC({
        name: elementName,
        content: `External reading [resource](https://example.com/reference-${testInfo.workerIndex}.pdf)`,
        choices: [
          { value: 'Correct', correct: true },
          { value: 'Distractor', correct: false },
        ],
        userId: importExportIsolation.users.owner.id,
      })

      await page.goto(process.env.URL_MANAGE ?? URL_MANAGE, {
        waitUntil: 'commit',
      })
      await expect(getElementsSearchInput(page)).toBeVisible({
        timeout: 30_000,
      })
      await validateElement(page, elementName)

      await openExportPackageModal(page, [elementName])
      await expect(
        page.getByTestId('element-export-package-warning')
      ).toHaveCount(0)
      await expect(
        page.getByTestId('download-selected-elements-package')
      ).toBeEnabled()
    }
  )

  importExportTest(
    'Export preview classifies media in answer-collection descriptions',
    async ({ importExportIsolation, page }, testInfo) => {
      const names = await seedPackageElements({
        page,
        suffix: `collection media ${testInfo.workerIndex}`,
        userId: importExportIsolation.users.owner.id,
        collectionDescription: `Collection image ![image](https://example.com/collection-${testInfo.workerIndex}.png)`,
      })

      await openExportPackageModal(page, [names.selection])
      await expect(
        page.getByTestId('element-export-package-warning')
      ).toContainText(
        messages.manage.elements.elementExportExternalMediaWarning
      )
      await expect(
        page.getByTestId('download-selected-elements-package')
      ).toBeEnabled()
    }
  )
}
