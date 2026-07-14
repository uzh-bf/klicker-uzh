import { AxeBuilder } from '@axe-core/playwright'
import deMessages from '../../../packages/i18n/messages/de.js'
import { URL_MANAGE } from '../../util/constants.js'
import { isGraphqlOperation } from '../../util/graphqlRequest.js'
import { enMessages as messages } from '../../util/messages.js'
import { expect, importExportTest } from './fixture.js'
import {
  downloadElementPackage,
  getElementsSearchInput,
  openImportPackageModal,
  packageEntries,
  seedNumericalPackageElement,
  seedPackageElements,
  uploadPackageFile,
} from './support.js'

export function registerWorkflowImportExportCases() {
  importExportTest(
    'Downloaded package can be imported back with inline preview in the same modal',
    async ({ importExportIsolation, page }, testInfo) => {
      testInfo.setTimeout(180_000)
      const names = await seedPackageElements({
        page,
        suffix: `roundtrip ${testInfo.workerIndex}`,
        userId: importExportIsolation.users.owner.id,
      })
      const zipPath = await downloadElementPackage({
        page,
        testInfo,
        elementNames: [names.singleChoice, names.selection],
      })

      await openImportPackageModal(page)
      await uploadPackageFile(page, zipPath)
      await expect(page.getByTestId('element-0-import')).toBeFocused()

      const dialog = page.getByRole('dialog')
      const previewPanel = page.getByTestId('element-import-preview-panel')
      await expect(dialog).toHaveCount(1)
      await expect(
        page.getByTestId('element-import-answer-collections-overview')
      ).toBeVisible()
      await expect(
        page.getByTestId('element-package-answer-collection-0')
      ).toContainText(names.collection)
      await expect(
        page.getByTestId('element-import-review-disclosures')
      ).toContainText(
        messages.manage.elements.elementImportCopyrightSolutionsDisclosure
      )
      await expect(
        page.getByTestId('element-import-review-disclosures')
      ).toContainText(
        messages.manage.elements.elementImportPsychometricDisclosure
      )
      await expect(
        page.getByTestId('element-import-selection-summary')
      ).toContainText('2 elements selected')
      await expect(previewPanel).toBeVisible()
      await expect(page.getByTestId('element-import-0')).toBeVisible()

      const selectionToggle = page.getByRole('checkbox', {
        name: `Import “${names.selection}”`,
      })
      await expect(selectionToggle).toBeChecked()
      await selectionToggle.click()
      await expect(
        page.getByTestId('element-import-selection-summary')
      ).toContainText('1 element selected')
      await expect(
        page.getByTestId('element-package-answer-collection-0')
      ).not.toBeAttached()
      await selectionToggle.click()
      await expect(
        page.getByTestId('element-package-answer-collection-0')
      ).toContainText(names.collection)

      const collectionOverview = page.getByTestId(
        'element-package-answer-collection-0'
      )
      await collectionOverview.locator('summary').click()
      await expect(collectionOverview).toContainText(packageEntries[0]!)
      await expect(collectionOverview).toContainText(packageEntries[2]!)

      await page.getByTestId('element-import-select-none').click()
      await expect(page.getByTestId('confirm-element-import')).toBeDisabled()
      await page.getByTestId('element-import-select-all').click()

      const modalBefore = await dialog.first().boundingBox()
      const panelBefore = await previewPanel.boundingBox()
      await page.getByTestId('preview-imported-element-0').click()
      await expect(
        page.getByTestId('element-import-preview-content')
      ).toBeVisible()
      await expect(
        page.getByTestId('element-import-didactic-review')
      ).toContainText(messages.manage.elements.elementImportDidacticReview)
      await expect(
        page.getByTestId('element-import-didactic-review')
      ).toContainText(messages.shared.REVIEW.statusLabel)
      const singleChoiceReview = page.getByTestId(
        'element-import-didactic-review'
      )
      await expect(
        singleChoiceReview.getByText(messages.shared.generic.correct, {
          exact: true,
        })
      ).toBeVisible()
      await expect(
        singleChoiceReview.getByText(
          messages.manage.elements.elementImportIncorrect,
          { exact: true }
        )
      ).toBeVisible()
      const accessibility = await new AxeBuilder({ page })
        .include('[data-cy="element-upload-modal"]')
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
      await expect(dialog).toHaveCount(1)
      await expect(previewPanel).toBeVisible()
      await testInfo.attach('element-import-review-desktop-en', {
        body: await page.screenshot(),
        contentType: 'image/png',
      })

      const modalAfter = await dialog.first().boundingBox()
      const panelAfter = await previewPanel.boundingBox()
      expect(
        Math.abs((modalAfter?.width ?? 0) - (modalBefore?.width ?? 0))
      ).toBeLessThan(40)
      expect(
        Math.abs((modalAfter?.height ?? 0) - (modalBefore?.height ?? 0))
      ).toBeLessThan(40)
      expect(
        Math.abs((panelAfter?.width ?? 0) - (panelBefore?.width ?? 0))
      ).toBeLessThan(80)
      expect(
        Math.abs((panelAfter?.height ?? 0) - (panelBefore?.height ?? 0))
      ).toBeLessThan(80)

      await page.getByTestId('preview-imported-element-1').click()
      const answerPool = page.getByTestId('element-import-answer-pool')
      await answerPool.getByText('3 answer-pool entries').click()
      await expect(answerPool).toContainText(packageEntries[0]!)
      await expect(answerPool).toContainText(packageEntries[2]!)

      await page.getByTestId('confirm-element-import').click()
      await expect(
        page.getByTestId('element-import-preview-panel')
      ).not.toBeAttached({
        timeout: 30000,
      })

      const searchInput = getElementsSearchInput(page)
      await searchInput.clear()
      await searchInput.fill(names.singleChoice)
      await page.keyboard.press('Enter')
      await expect(
        page.getByTestId(`element-item-${names.singleChoice}`)
      ).toHaveCount(2)

      await searchInput.clear()
      await searchInput.fill(names.selection)
      await page.keyboard.press('Enter')
      await expect(
        page.getByTestId(`element-item-${names.selection}`)
      ).toHaveCount(2)
    }
  )

  importExportTest(
    'Committed import stays non-dismissible and a refresh failure remains a success',
    async ({ importExportIsolation, page }, testInfo) => {
      const names = await seedPackageElements({
        page,
        suffix: `refresh warning ${testInfo.workerIndex}`,
        userId: importExportIsolation.users.owner.id,
      })
      const zipPath = await downloadElementPackage({
        page,
        testInfo,
        elementNames: [names.singleChoice, names.selection],
      })

      await openImportPackageModal(page)
      await uploadPackageFile(page, zipPath)

      let releaseImport!: () => void
      const importGate = new Promise<void>((resolve) => {
        releaseImport = resolve
      })
      let importCalls = 0
      let failNextElementRefresh = false
      let releaseElementRefresh!: () => void
      let elementRefreshStarted!: () => void
      const elementRefreshGate = new Promise<void>((resolve) => {
        releaseElementRefresh = resolve
      })
      const elementRefreshRequest = new Promise<void>((resolve) => {
        elementRefreshStarted = resolve
      })
      await page.route('**/api/graphql*', async (route) => {
        const request = route.request()

        if (isGraphqlOperation(request, 'ImportElementPackage')) {
          importCalls += 1
          await importGate
          failNextElementRefresh = true
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                importElementPackage: {
                  importedElements: 2,
                  importedAnswerCollections: 1,
                  skippedElements: 0,
                  warnings: [],
                },
              },
            }),
          })
          return
        }

        if (
          failNextElementRefresh &&
          isGraphqlOperation(request, 'GetUserElements')
        ) {
          failNextElementRefresh = false
          elementRefreshStarted()
          await elementRefreshGate
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              errors: [{ message: 'Synthetic post-commit refresh failure' }],
            }),
          })
          return
        }

        await route.continue()
      })

      try {
        await page.getByTestId('confirm-element-import').click()
        await expect(
          page.getByTestId('element-import-workflow')
        ).toHaveAttribute('aria-busy', 'true')
        await expect(page.getByTestId('element-import-status')).toBeVisible()
        await expect(
          page.getByTestId('close-element-upload-modal')
        ).not.toBeAttached()
        await expect(
          page.getByTestId('cancel-element-upload-modal')
        ).not.toBeAttached()
        await expect(
          page.getByTestId('element-import-dropzone')
        ).toHaveAttribute('aria-disabled', 'true')
        await page.keyboard.press('Escape')
        await expect(page.getByRole('dialog')).toBeVisible()

        releaseImport()
        await elementRefreshRequest
        try {
          await expect(
            page.getByTestId('element-import-workflow')
          ).toHaveAttribute('aria-busy', 'true')
          await expect(
            page.getByTestId('element-import-completion')
          ).toBeVisible()
          await expect(
            page.getByTestId('close-element-upload-modal')
          ).not.toBeAttached()
          await expect(
            page.getByTestId('cancel-element-upload-modal')
          ).not.toBeAttached()
          await expect(page.getByTestId('element-import-status')).toContainText(
            messages.manage.elements.elementImportStatusRefreshing
          )
          await expect(page.getByTestId('element-import-status')).toBeVisible()
          await page.keyboard.press('Escape')
          await expect(page.getByRole('dialog')).toBeVisible()
        } finally {
          releaseElementRefresh()
        }
        await expect(
          page
            .getByLabel('Notifications alt+T')
            .getByText('2 elements were imported successfully.')
        ).toBeVisible()
        await expect(
          page
            .getByLabel('Notifications alt+T')
            .getByText(messages.manage.elements.elementImportRefreshFailed)
        ).toBeVisible()
        await expect(page.getByRole('dialog')).toBeVisible()
        await expect(
          page.getByTestId('close-element-upload-modal')
        ).toBeEnabled()
        await testInfo.attach('element-import-success-refresh-warning-en', {
          body: await page.screenshot(),
          contentType: 'image/png',
        })
        await page.getByTestId('close-element-upload-modal').click()
        await expect(page.getByRole('dialog')).not.toBeAttached()
        expect(importCalls).toBe(1)
      } finally {
        releaseImport()
        releaseElementRefresh()
      }
    }
  )

  importExportTest(
    'A null import result remains a reviewable failure instead of reporting success',
    async ({ importExportIsolation, page }, testInfo) => {
      const names = await seedPackageElements({
        page,
        suffix: `null result ${testInfo.workerIndex}`,
        userId: importExportIsolation.users.owner.id,
      })
      const zipPath = await downloadElementPackage({
        page,
        testInfo,
        elementNames: [names.singleChoice],
      })

      await openImportPackageModal(page)
      await uploadPackageFile(page, zipPath)
      await page.route('**/api/graphql*', async (route) => {
        if (isGraphqlOperation(route.request(), 'ImportElementPackage')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: { importElementPackage: null },
            }),
          })
          return
        }

        await route.continue()
      })

      await page.getByTestId('confirm-element-import').click()
      await expect(
        page
          .getByLabel('Notifications alt+T')
          .getByText(messages.manage.elements.elementImportError)
      ).toBeVisible()
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByTestId('confirm-element-import')).toBeEnabled()
      await expect(page.getByTestId('element-import-workflow')).toHaveAttribute(
        'aria-busy',
        'false'
      )
    }
  )

  importExportTest(
    'Cancelling validation closes the workflow and stale results cannot reopen it',
    async ({ importExportIsolation, page }, testInfo) => {
      const names = await seedPackageElements({
        page,
        suffix: `cancel validation ${testInfo.workerIndex}`,
        userId: importExportIsolation.users.owner.id,
      })
      const zipPath = await downloadElementPackage({
        page,
        testInfo,
        elementNames: [names.singleChoice],
      })

      let releaseValidation!: () => void
      let validationStarted!: () => void
      const validationGate = new Promise<void>((resolve) => {
        releaseValidation = resolve
      })
      const validationRequest = new Promise<void>((resolve) => {
        validationStarted = resolve
      })
      let recordValidationDeliveryOutcome!: (responseDelivered: boolean) => void
      const validationDeliveryOutcome = new Promise<boolean>((resolve) => {
        recordValidationDeliveryOutcome = resolve
      })
      let validationPageRequest: Parameters<
        typeof importExportIsolation.markRequestAbortedBeforeServer
      >[0]
      await page.route('**/api/graphql*', async (route) => {
        if (
          !isGraphqlOperation(route.request(), 'ValidateElementImportPackage')
        ) {
          await route.continue()
          return
        }

        validationPageRequest = route.request()
        validationStarted()
        await validationGate
        try {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                validateElementImportPackage: {
                  importToken: 'stale-validation-token',
                  warnings: [],
                  errors: [],
                  answerCollections: [],
                  elements: [
                    {
                      ref: 'stale-content',
                      name: 'Stale content',
                      content: 'Stale response must be ignored',
                      type: 'CONTENT',
                      options: {
                        __typename: 'ElementImportPackagePreviewContentOptions',
                        type: 'CONTENT',
                      },
                      pointsMultiplier: 1,
                      basePoints: false,
                      explanation: null,
                      status: 'REVIEW',
                      alreadyImported: false,
                      existingElementId: null,
                      existingElementName: null,
                      answerCollectionId: null,
                      answerCollectionRef: null,
                      answerCollectionItemIds: [],
                    },
                  ],
                },
              },
            }),
          })
          recordValidationDeliveryOutcome(true)
        } catch {
          // Closing the workflow normally aborts the request before this
          // synthetic late response can be delivered. Keep both browser
          // outcomes deterministic without ever continuing to the backend.
          recordValidationDeliveryOutcome(false)
        }
      })

      try {
        await openImportPackageModal(page)
        await expect(page.getByTestId('element-import-dropzone')).toBeFocused()
        await uploadPackageFile(page, zipPath)
        await validationRequest
        await expect(
          page.getByTestId('element-import-workflow')
        ).toHaveAttribute('aria-busy', 'true')
        await expect(page.getByTestId('element-import-status')).toContainText(
          messages.manage.elements.elementImportStatusValidating
        )
        await expect(
          page.getByTestId('element-import-dropzone')
        ).toHaveAttribute('aria-disabled', 'true')
        await testInfo.attach('element-import-validating-en', {
          body: await page.screenshot(),
          contentType: 'image/png',
        })

        const validationFailure = page.waitForEvent('requestfailed', {
          timeout: 30_000,
          predicate: (request) => request === validationPageRequest,
        })
        void validationFailure.catch(() => undefined)
        const validationFinished = page.waitForEvent('requestfinished', {
          timeout: 30_000,
          predicate: (request) => request === validationPageRequest,
        })
        void validationFinished.catch(() => undefined)
        const validationSettled = Promise.race([
          validationFailure.then(() => 'failed' as const),
          validationFinished.then(() => 'finished' as const),
        ])
        void validationSettled.catch(() => undefined)
        await page.getByTestId('cancel-element-upload-modal').click()
        await expect(page.getByRole('dialog')).not.toBeAttached()
        await expect(page.getByTestId('elements-upload')).toBeFocused()

        releaseValidation()
        const responseDelivered = await validationDeliveryOutcome
        const settlement = await validationSettled
        expect(settlement).toBe(responseDelivered ? 'finished' : 'failed')
        if (!responseDelivered) {
          importExportIsolation.markRequestAbortedBeforeServer(
            validationPageRequest!
          )
        }
        await page.evaluate(
          () =>
            new Promise<void>((resolve) => {
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve())
              )
            })
        )
        await expect(
          page.getByTestId('confirm-element-import')
        ).not.toBeAttached()
        await expect(page.getByRole('dialog')).not.toBeAttached()
      } finally {
        releaseValidation()
      }
    }
  )

  importExportTest(
    'German import review remains usable without horizontal overflow at 375px and 320px',
    async ({ importExportIsolation, page }, testInfo) => {
      testInfo.setTimeout(180_000)
      const names = await seedPackageElements({
        page,
        suffix: `responsive de ${testInfo.workerIndex}`,
        userId: importExportIsolation.users.owner.id,
      })
      const numericalPlaceholder = 'Δx ≈ 3,14\u202fµm 🧪'
      const numericalName = await seedNumericalPackageElement({
        name: `PW Package Numerical responsive de ${testInfo.workerIndex}`,
        content: `Numerical package content responsive de ${testInfo.workerIndex}`,
        placeholder: numericalPlaceholder,
        userId: importExportIsolation.users.owner.id,
      })
      const zipPath = await downloadElementPackage({
        page,
        testInfo,
        elementNames: [names.singleChoice, names.selection, numericalName],
      })

      await page.setViewportSize({ width: 375, height: 812 })
      await page.goto(
        new URL('/de', process.env.URL_MANAGE ?? URL_MANAGE).toString(),
        { waitUntil: 'commit' }
      )
      await expect(page.getByTestId('elements-upload')).toBeVisible()
      await expect
        .poll(() => page.evaluate(() => document.documentElement.lang))
        .toBe('de')
      await openImportPackageModal(page)
      await uploadPackageFile(page, zipPath)
      await expect(page.getByTestId('element-import-review-form')).toBeVisible()
      await expect(
        page.getByTestId('element-import-review-disclosures')
      ).toContainText(
        deMessages.manage.elements.elementImportPsychometricDisclosure
      )
      await expect(page.getByTestId('element-import-0')).toHaveCount(1)
      await expect(page.getByTestId('element-import-1')).toHaveCount(1)
      await expect(page.getByTestId('element-import-2')).toHaveCount(1)
      await page.getByTestId('preview-imported-element-2').click()
      await expect(
        page.getByTestId('element-import-didactic-review')
      ).toContainText(numericalPlaceholder)

      for (const viewport of [
        { width: 375, height: 812, name: '375px' },
        { width: 320, height: 720, name: '320px' },
      ]) {
        await page.setViewportSize(viewport)
        const modal = page.getByTestId('element-upload-modal')
        await expect(modal).toBeVisible()
        const modalBox = await modal.boundingBox()
        expect(modalBox?.x ?? -1).toBeGreaterThanOrEqual(0)
        expect(
          (modalBox?.x ?? 0) + (modalBox?.width ?? Infinity)
        ).toBeLessThanOrEqual(viewport.width)
        expect(
          await modal.evaluate(
            (element) => element.scrollWidth <= element.clientWidth
          )
        ).toBe(true)
        await page
          .getByTestId('confirm-element-import')
          .scrollIntoViewIfNeeded()
        await expect(page.getByTestId('confirm-element-import')).toBeEnabled()
        await testInfo.attach(`element-import-review-${viewport.name}-de`, {
          body: await page.screenshot(),
          contentType: 'image/png',
        })
      }

      await page.getByTestId('close-element-upload-modal').click()
      await expect(page.getByTestId('elements-upload')).toBeFocused()
    }
  )
}
