import { ELEMENT_IMPORT_EXPORT_PACKAGE_MAX_BYTES } from '@klicker-uzh/types'
import { writeFile } from 'node:fs/promises'
import { isGraphqlOperation } from '../../util/graphqlRequest.js'
import { enMessages as messages } from '../../util/messages.js'
import { expect, importExportTest } from './fixture.js'
import {
  downloadElementPackage,
  expectAnswerCollectionCount,
  expectElementSearchResultCount,
  importPackageFile,
  observeImportValidationBoundary,
  observePreparePackageUploadRequests,
  openElementsLibraryPage,
  openExportPackageModal,
  openImportPackageModal,
  openShareModalForElement,
  packageEntries,
  seedPackageElements,
  shareAnswerCollectionWithUser,
  shareElementWithUser,
  uploadPackageFile,
  verifyReadOnlyAnswerCollectionVisible,
} from './support.js'

export function registerSecurityErrorImportExportCases() {
  importExportTest(
    'Package import creates private copies without carrying shared permissions',
    async (
      {
        importExportIsolation,
        page,
        loginLecturer,
        loginInstitutionalCatalyst,
        loginInstitutionalCatalyst2,
        logoutUser,
      },
      testInfo
    ) => {
      testInfo.setTimeout(120_000)
      const names = await seedPackageElements({
        page,
        suffix: `permission isolation ${testInfo.workerIndex}`,
        userId: importExportIsolation.users.owner.id,
      })

      await openShareModalForElement(page, names.selection)
      await shareElementWithUser(page, {
        shortnameOrEmail: importExportIsolation.users.shared.shortname,
        ownerPermissionKey: importExportIsolation.users.owner.shortname,
        permission: messages.manage.sharing.permissionsWRITE,
      })
      await page.getByTestId('close-share-object').click()

      await shareAnswerCollectionWithUser(page, {
        collectionName: names.collection,
        shortnameOrEmail: importExportIsolation.users.shared.shortname,
        ownerPermissionKey: importExportIsolation.users.owner.shortname,
        permission: messages.manage.sharing.permissionsWRITE,
      })

      await openElementsLibraryPage(page)
      const zipPath = await downloadElementPackage({
        page,
        testInfo,
        elementNames: [names.selection],
      })

      await logoutUser()
      await loginInstitutionalCatalyst()
      await openElementsLibraryPage(page)
      await expectElementSearchResultCount(page, names.selection, 1)
      await expectAnswerCollectionCount(page, names.collection, 1)

      await logoutUser()
      await loginInstitutionalCatalyst2()
      await openElementsLibraryPage(page)
      const stopObservingValidation = await observeImportValidationBoundary(
        page,
        importExportIsolation.users.importer.id
      )
      try {
        await importPackageFile(page, zipPath)
      } finally {
        await stopObservingValidation()
      }
      await expectElementSearchResultCount(page, names.selection, 1)
      await expectAnswerCollectionCount(page, names.collection, 1)

      await logoutUser()
      await loginLecturer()
      await openElementsLibraryPage(page)
      await expectElementSearchResultCount(page, names.selection, 1)
      await expectAnswerCollectionCount(page, names.collection, 1)

      await logoutUser()
      await loginInstitutionalCatalyst()
      await openElementsLibraryPage(page)
      await expectElementSearchResultCount(page, names.selection, 1)
      await expectAnswerCollectionCount(page, names.collection, 1)
    }
  )

  importExportTest(
    'Invalid package upload is rejected before import confirmation',
    async ({ page }, testInfo) => {
      const invalidPackage = testInfo.outputPath('invalid-elements.zip')
      await writeFile(invalidPackage, Buffer.from('not a zip package'))

      await openImportPackageModal(page)
      await testInfo.attach('element-import-idle-en', {
        body: await page.screenshot(),
        contentType: 'image/png',
      })
      await uploadPackageFile(page, invalidPackage)

      await expect(
        page.getByTestId('element-import-package-error')
      ).toContainText(messages.manage.elements.elementImportInvalidFile, {
        timeout: 30000,
      })
      await testInfo.attach('element-import-validation-error-en', {
        body: await page.screenshot(),
        contentType: 'image/png',
      })
      await expect(
        page.getByTestId('element-import-preview-panel')
      ).not.toBeAttached()
      await expect(
        page.getByTestId('element-import-answer-collections-overview')
      ).not.toBeAttached()
      await expect(
        page.getByTestId('confirm-element-import')
      ).not.toBeAttached()
    }
  )

  importExportTest(
    'Import errors render localized codes without leaking server messages',
    async ({ page }, testInfo) => {
      const packagePath = testInfo.outputPath('coded-error-elements.zip')
      const sensitiveMessage =
        'secret storage path: imports/private-user/authored-package.zip'
      const consoleMessages: string[] = []
      page.on('console', (message) => consoleMessages.push(message.text()))
      await writeFile(packagePath, Buffer.from('request stops before upload'))

      await openImportPackageModal(page)
      await page.route('**/api/graphql*', async (route) => {
        if (
          !isGraphqlOperation(
            route.request(),
            'PrepareElementImportPackageUpload'
          )
        ) {
          await route.continue()
          return
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { prepareElementImportPackageUpload: null },
            errors: [
              {
                message: sensitiveMessage,
                extensions: { code: 'IMPORT_EXPORT_RATE_LIMITED' },
              },
            ],
          }),
        })
      })

      await uploadPackageFile(page, packagePath)

      const error = page.getByTestId('element-import-package-error')
      await expect(error).toContainText(
        messages.manage.elements.elementImportRateLimited
      )
      await expect(error).not.toContainText(sensitiveMessage)
      await expect(error).not.toContainText('IMPORT_EXPORT_RATE_LIMITED')
      expect(consoleMessages.join('\n')).not.toContain(sensitiveMessage)
    }
  )

  importExportTest(
    'Aggregate-limit errors show split-package recovery guidance',
    async ({ page }, testInfo) => {
      const packagePath = testInfo.outputPath('aggregate-limit-elements.zip')
      await writeFile(packagePath, Buffer.from('request stops before upload'))

      await openImportPackageModal(page)
      await page.route('**/api/graphql*', async (route) => {
        if (
          !isGraphqlOperation(
            route.request(),
            'PrepareElementImportPackageUpload'
          )
        ) {
          await route.continue()
          return
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { prepareElementImportPackageUpload: null },
            errors: [
              {
                message: 'Package contains too many resources.',
                extensions: { code: 'IMPORT_AGGREGATE_LIMIT' },
              },
            ],
          }),
        })
      })

      await uploadPackageFile(page, packagePath)

      const error = page.getByTestId('element-import-package-error')
      await expect(error).toContainText(
        messages.manage.elements.elementImportAggregateLimit
      )
      await expect(error).not.toContainText('10 MB')
    }
  )

  importExportTest(
    'Non-ZIP uploads are rejected before package upload preparation',
    async ({ page }, testInfo) => {
      const invalidTextPackage = testInfo.outputPath('invalid-elements.txt')

      await writeFile(invalidTextPackage, Buffer.from('not a zip package'))

      await openImportPackageModal(page)
      const getPrepareRequests = observePreparePackageUploadRequests(page)

      await uploadPackageFile(page, invalidTextPackage)
      await expect(
        page.getByTestId('element-import-package-error')
      ).toContainText(messages.manage.elements.elementImportInvalidFile)
      expect(getPrepareRequests()).toBe(0)
    }
  )

  importExportTest(
    'Oversized uploads are rejected before package upload preparation',
    async ({ page }, testInfo) => {
      const oversizedPackage = testInfo.outputPath('oversized-elements.zip')

      await writeFile(
        oversizedPackage,
        Buffer.alloc(ELEMENT_IMPORT_EXPORT_PACKAGE_MAX_BYTES + 1)
      )

      await openImportPackageModal(page)
      const getPrepareRequests = observePreparePackageUploadRequests(page)

      await uploadPackageFile(page, oversizedPackage)
      await expect(
        page.getByTestId('element-import-package-error')
      ).toContainText(
        messages.manage.elements.elementImportFileTooLarge.replace(
          '{size}',
          '10 MB'
        )
      )
      expect(getPrepareRequests()).toBe(0)
    }
  )

  importExportTest(
    'READ permission cannot export an element package',
    async (
      { importExportIsolation, page, loginInstitutionalCatalyst, logoutUser },
      testInfo
    ) => {
      const names = await seedPackageElements({
        page,
        suffix: `read blocked ${testInfo.workerIndex}`,
        userId: importExportIsolation.users.owner.id,
      })

      await openShareModalForElement(page, names.singleChoice)
      await shareElementWithUser(page, {
        shortnameOrEmail: importExportIsolation.users.shared.shortname,
        ownerPermissionKey: importExportIsolation.users.owner.shortname,
        permission: messages.manage.sharing.permissionsREAD,
      })
      await page.getByTestId('close-share-object').click()

      await logoutUser()
      await loginInstitutionalCatalyst()
      await openExportPackageModal(page, [names.singleChoice])
      await expect(
        page.getByTestId('element-export-answer-collections-overview')
      ).toBeVisible()
      await expect(
        page.getByTestId('download-selected-elements-package')
      ).toBeDisabled()
      await expect(
        page.getByTestId('element-export-answer-collections-overview-error')
      ).toContainText(
        messages.manage.elements.packageElementExportPermissionError
      )
      await expect(
        page.getByTestId('element-export-preview-retry')
      ).not.toBeAttached()
    }
  )

  importExportTest(
    'READ access to a linked answer collection is visible but cannot be exported in a package',
    async (
      { importExportIsolation, page, loginInstitutionalCatalyst, logoutUser },
      testInfo
    ) => {
      const names = await seedPackageElements({
        page,
        suffix: `collection read blocked ${testInfo.workerIndex}`,
        userId: importExportIsolation.users.owner.id,
      })

      await openShareModalForElement(page, names.selection)
      await shareElementWithUser(page, {
        shortnameOrEmail: importExportIsolation.users.shared.shortname,
        ownerPermissionKey: importExportIsolation.users.owner.shortname,
        permission: messages.manage.sharing.permissionsADMIN,
      })
      await page.getByTestId('close-share-object').click()

      await shareAnswerCollectionWithUser(page, {
        collectionName: names.collection,
        shortnameOrEmail: importExportIsolation.users.shared.shortname,
        ownerPermissionKey: importExportIsolation.users.owner.shortname,
        permission: messages.manage.sharing.permissionsREAD,
      })

      await logoutUser()
      await loginInstitutionalCatalyst()
      await verifyReadOnlyAnswerCollectionVisible(
        page,
        names.collection,
        packageEntries
      )
      await openElementsLibraryPage(page)
      await openExportPackageModal(page, [names.selection])

      const overview = page.getByTestId(
        'element-export-answer-collections-overview'
      )
      await expect(overview).toBeVisible()
      await expect(overview).toContainText(
        messages.manage.elements.packageAnswerCollectionExportPermissionError
      )
      await expect(overview).not.toContainText(names.collection)
      for (const entry of packageEntries) {
        await expect(overview).not.toContainText(entry)
      }

      await expect(
        page.getByTestId('download-selected-elements-package')
      ).toBeDisabled()
      await expect(
        page.getByTestId('element-export-answer-collections-overview-error')
      ).toContainText(
        messages.manage.elements.packageAnswerCollectionExportPermissionError
      )
      await expect(
        page.getByTestId('element-export-preview-retry')
      ).not.toBeAttached()
    }
  )

  importExportTest(
    'A null export preview fails closed instead of enabling a package download',
    async ({ importExportIsolation, page }, testInfo) => {
      const names = await seedPackageElements({
        page,
        suffix: `null export preview ${testInfo.workerIndex}`,
        userId: importExportIsolation.users.owner.id,
      })

      await page.route('**/api/graphql*', async (route) => {
        if (
          !isGraphqlOperation(route.request(), 'GetElementExportPackagePreview')
        ) {
          await route.continue()
          return
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { getElementExportPackagePreview: null },
          }),
        })
      })

      await openExportPackageModal(page, [names.singleChoice])

      const previewError = page.getByTestId(
        'element-export-answer-collections-overview-error'
      )
      await expect(previewError).toContainText(
        messages.manage.elements.packageServiceUnavailableError
      )
      await expect(
        page.getByTestId('download-selected-elements-package')
      ).toBeDisabled()
      await expect(
        page.getByTestId('element-export-preview-retry')
      ).toBeVisible()
    }
  )

  importExportTest(
    'Transient export preview errors can be retried',
    async ({ importExportIsolation, page }, testInfo) => {
      const names = await seedPackageElements({
        page,
        suffix: `transient preview ${testInfo.workerIndex}`,
        userId: importExportIsolation.users.owner.id,
      })
      let previewRequestCount = 0

      await page.route('**/api/graphql*', async (route) => {
        if (
          !isGraphqlOperation(route.request(), 'GetElementExportPackagePreview')
        ) {
          await route.continue()
          return
        }

        previewRequestCount += 1
        if (previewRequestCount > 1) {
          await route.continue()
          return
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              getElementExportPackagePreview: {
                errors: ['IMPORT_EXPORT_INFRASTRUCTURE_FAILURE'],
                warnings: [],
                answerCollections: [],
              },
            },
          }),
        })
      })

      await openExportPackageModal(page, [names.singleChoice])

      const previewError = page.getByTestId(
        'element-export-answer-collections-overview-error'
      )
      const previewOverview = page.getByTestId(
        'element-export-answer-collections-overview'
      )
      await expect(previewError).toContainText(
        messages.manage.elements.packageServiceUnavailableError
      )
      await page.getByTestId('element-export-preview-retry').click()

      await expect(previewError).not.toBeAttached()
      await expect(
        page.getByTestId('download-selected-elements-package')
      ).toBeEnabled()
      await expect(previewOverview).toBeFocused()
      expect(previewRequestCount).toBeGreaterThanOrEqual(2)
    }
  )
}
