import { randomUUID } from 'node:crypto'
import { URL_MANAGE } from '../../util/constants.js'
import { isGraphqlOperation } from '../../util/graphqlRequest.js'
import { enMessages as messages } from '../../util/messages.js'
import { expect, importExportTest } from './fixture.js'
import { openImportPackageModal } from './support.js'

export function registerDidacticPerformanceImportExportCases() {
  importExportTest(
    'Didactic review exposes every supported element type without tags or collapsed pool inflation',
    async ({ page }) => {
      const fakeUploadURL = new URL(
        '/fake-didactic-package-upload',
        process.env.URL_MANAGE ?? URL_MANAGE
      ).toString()
      const caseStudyPoolEntries = [
        { id: 101, value: 'Didactic Pool A' },
        { id: 102, value: 'Didactic Pool B' },
        { id: 103, value: 'Didactic Pool C' },
      ]
      const selectionPoolEntries = Array.from({ length: 101 }, (_, index) => ({
        id: 1_000 + index,
        value: `Didactic Selection Pool ${index + 1}`,
      }))
      const common = {
        pointsMultiplier: 2,
        basePoints: true,
        status: 'REVIEW',
        alreadyImported: false,
        existingElementId: null,
        existingElementName: null,
        answerCollectionId: null,
        answerCollectionRef: null,
        answerCollectionItemIds: [],
      }
      const choiceOptions = (prefix: string) => ({
        displayMode: 'LIST',
        hasSampleSolution: false,
        hasAnswerFeedbacks: true,
        choices: [
          {
            id: `${prefix}-correct`,
            ix: 0,
            value: `${prefix} correct choice`,
            correct: null,
            feedback: `${prefix} feedback`,
          },
          {
            id: `${prefix}-incorrect`,
            ix: 1,
            value: `${prefix} incorrect choice`,
            correct: null,
            feedback: null,
          },
        ],
      })
      const didacticElements = [
        {
          ...common,
          ref: 'didactic-sc',
          name: 'Didactic SC',
          content: 'Didactic single choice content',
          explanation: 'Didactic SC explanation',
          type: 'SC',
          options: {
            __typename: 'ElementImportPackagePreviewSCOptions',
            type: 'SC',
            ...choiceOptions('SC'),
          },
        },
        {
          ...common,
          ref: 'didactic-mc',
          name: 'Didactic MC',
          content: 'Didactic multiple choice content',
          explanation: 'Didactic MC explanation',
          type: 'MC',
          options: {
            __typename: 'ElementImportPackagePreviewMCOptions',
            type: 'MC',
            ...choiceOptions('MC'),
          },
        },
        {
          ...common,
          ref: 'didactic-kprim',
          name: 'Didactic KPRIM',
          content: 'Didactic KPRIM content',
          explanation: 'Didactic KPRIM explanation',
          type: 'KPRIM',
          options: {
            __typename: 'ElementImportPackagePreviewKPRIMOptions',
            type: 'KPRIM',
            ...choiceOptions('KPRIM'),
            choices: Array.from({ length: 4 }, (_, index) => ({
              id: `kprim-${index}`,
              ix: index,
              value: `KPRIM choice ${index + 1}`,
              correct: null,
              feedback: index === 0 ? 'KPRIM feedback' : null,
            })),
          },
        },
        {
          ...common,
          ref: 'didactic-numerical',
          name: 'Didactic Numerical',
          content: 'Didactic numerical content',
          explanation: 'Didactic numerical explanation',
          type: 'NUMERICAL',
          options: {
            __typename: 'ElementImportPackagePreviewNumericalOptions',
            type: 'NUMERICAL',
            hasSampleSolution: true,
            accuracy: 2,
            placeholder: 'Δx ≈ 3,14\u202fµm 🧪',
            unit: 'kg',
            restrictions: { min: 0, max: 100 },
            solutionRanges: [{ min: 10, max: 20 }],
          },
        },
        {
          ...common,
          ref: 'didactic-free-text',
          name: 'Didactic Free Text',
          content: 'Didactic free-text content',
          explanation: 'Didactic free-text explanation',
          type: 'FREE_TEXT',
          options: {
            __typename: 'ElementImportPackagePreviewFreeTextOptions',
            type: 'FREE_TEXT',
            hasSampleSolution: true,
            restrictions: { maxLength: 240 },
            solutions: ['Accepted free-text solution'],
          },
        },
        {
          ...common,
          ref: 'didactic-content',
          name: 'Didactic Content',
          content: 'Didactic standalone content',
          explanation: null,
          type: 'CONTENT',
          options: {
            __typename: 'ElementImportPackagePreviewContentOptions',
            type: 'CONTENT',
          },
        },
        {
          ...common,
          ref: 'didactic-flashcard',
          name: 'Didactic Flashcard',
          content: 'Didactic flashcard front',
          explanation: 'Didactic flashcard answer',
          type: 'FLASHCARD',
          options: {
            __typename: 'ElementImportPackagePreviewFlashcardOptions',
            type: 'FLASHCARD',
          },
        },
        {
          ...common,
          ref: 'didactic-selection',
          name: 'Didactic Selection',
          content: 'Didactic selection content',
          explanation: 'Didactic selection explanation',
          type: 'SELECTION',
          options: {
            __typename: 'ElementImportPackagePreviewSelectionOptions',
            type: 'SELECTION',
            hasSampleSolution: true,
            numberOfInputs: 2,
          },
          answerCollectionRef: 'didactic-selection-pool',
          answerCollectionItemIds: selectionPoolEntries
            .slice(0, 2)
            .map((entry) => entry.id),
        },
        {
          ...common,
          ref: 'didactic-case-study',
          name: 'Didactic Case Study',
          content: 'Didactic case-study instructions',
          explanation: 'Didactic case-study explanation',
          type: 'CASE_STUDY',
          options: {
            __typename: 'ElementImportPackagePreviewCaseStudyOptions',
            type: 'CASE_STUDY',
            hasSampleSolution: true,
            criteria: [
              {
                id: 'quality',
                name: 'Quality criterion',
                min: 0,
                max: 10,
                step: 1,
                unit: 'points',
                labels: { min: 'Low', mid: 'Medium', max: 'High' },
              },
            ],
            cases: [
              {
                id: 'case-alpha',
                title: 'Case Alpha',
                description: 'Case Alpha description',
                solutions: [
                  {
                    itemId: 101,
                    criteriaSolutions: [
                      { criterionId: 'quality', min: 4, max: 8 },
                    ],
                  },
                ],
              },
            ],
          },
          answerCollectionRef: 'didactic-case-study-pool',
          answerCollectionItemIds: caseStudyPoolEntries
            .slice(0, 2)
            .map((entry) => entry.id),
        },
      ]

      await page.route('**/fake-didactic-package-upload', async (route) => {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ replayed: false }),
        })
      })
      await page.route('**/api/graphql*', async (route) => {
        const request = route.request()
        if (isGraphqlOperation(request, 'PrepareElementImportPackageUpload')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                prepareElementImportPackageUpload: {
                  uploadURL: fakeUploadURL,
                  uploadCapability: 'playwright-didactic-capability',
                  artifactId: randomUUID(),
                  expiresAt: new Date(Date.now() + 60_000).toISOString(),
                },
              },
            }),
          })
          return
        }
        if (isGraphqlOperation(request, 'ValidateElementImportPackage')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                validateElementImportPackage: {
                  importToken: 'playwright-didactic-token',
                  warnings: ['IMPORT_UNUSED_MEDIA'],
                  errors: [],
                  answerCollections: [
                    {
                      ref: 'didactic-selection-pool',
                      name: 'Didactic selection answer pool',
                      description: 'Paginated didactic selection answer pool',
                      alreadyImported: false,
                      existingAnswerCollectionId: null,
                      existingAnswerCollectionName: null,
                      entries: selectionPoolEntries,
                    },
                    {
                      ref: 'didactic-case-study-pool',
                      name: 'Didactic case-study answer pool',
                      description: 'Small didactic case-study answer pool',
                      alreadyImported: false,
                      existingAnswerCollectionId: null,
                      existingAnswerCollectionName: null,
                      entries: caseStudyPoolEntries,
                    },
                  ],
                  elements: didacticElements,
                },
              },
            }),
          })
          return
        }

        await route.continue()
      })

      await openImportPackageModal(page)
      await page
        .getByTestId('element-import-dropzone')
        .locator('input[type="file"]')
        .setInputFiles({
          name: 'didactic-elements.zip',
          mimeType: 'application/zip',
          buffer: Buffer.from('PK\u0003\u0004didactic-elements'),
        })
      await expect(
        page.getByTestId('element-import-selection-list')
      ).toBeVisible()
      await expect(
        page.getByTestId('element-import-selection-list').locator(':scope > li')
      ).toHaveCount(9)
      await expect(
        page.getByTestId('element-upload-modal').locator('[data-cy*="tag"]')
      ).toHaveCount(0)
      const packageWarning = page.getByTestId('element-import-package-warning')
      await expect(packageWarning).toHaveAttribute('role', 'status')
      await expect(packageWarning).toHaveAttribute('aria-live', 'polite')
      await expect(packageWarning).toHaveAttribute('aria-atomic', 'true')

      const review = page.getByTestId('element-import-didactic-review')
      const studentPreview = page.getByTestId('student-element-preview')
      const reviewField = (label: string) =>
        review
          .locator('dt')
          .filter({ hasText: label })
          .locator('..')
          .locator('dd')
      const expectNeutralChoices = async () => {
        await expect(
          review.getByTestId('element-import-no-sample-solution')
        ).toBeVisible()
        await expect(
          review.getByText(messages.shared.generic.correct, { exact: true })
        ).toHaveCount(0)
        await expect(
          review.getByText(messages.manage.elements.elementImportIncorrect, {
            exact: true,
          })
        ).toHaveCount(0)
      }
      const preview = async (index: number, content: string) => {
        await page.getByTestId(`preview-imported-element-${index}`).click()
        await expect(review).toBeVisible()
        await expect(studentPreview).toBeVisible()
        await expect(studentPreview).toContainText(content)
      }

      await preview(0, 'Didactic single choice content')
      await expect(
        studentPreview.getByTestId('sc-0-answer-option-0')
      ).toBeVisible()
      await expect(review).toContainText('SC correct choice')
      await expect(review).toContainText('SC feedback')
      await expect(reviewField(messages.shared.generic.basePoints)).toHaveText(
        messages.shared.generic.yes
      )
      await expect(reviewField(messages.shared.generic.multiplier)).toHaveText(
        '2'
      )
      await expectNeutralChoices()
      await preview(1, 'Didactic multiple choice content')
      await expect(
        studentPreview.getByTestId('mc-0-answer-option-0')
      ).toBeVisible()
      await expect(review).toContainText('MC correct choice')
      await expectNeutralChoices()
      await preview(2, 'Didactic KPRIM content')
      await expect(studentPreview.getByTestId('kp-answer-options')).toHaveCount(
        4
      )
      await expect(review).toContainText('KPRIM feedback')
      await expectNeutralChoices()
      await preview(3, 'Didactic numerical content')
      await expect(
        studentPreview.getByTestId('input-numerical-0')
      ).toHaveAttribute('placeholder', 'Δx ≈ 3,14\u202fµm 🧪')
      await expect(review).toContainText('kg')
      await expect(review).toContainText('Δx ≈ 3,14\u202fµm 🧪')
      await expect(review).toContainText('10 – 20')
      await preview(4, 'Didactic free-text content')
      await expect(
        studentPreview.getByTestId('free-text-input-0')
      ).toBeVisible()
      await expect(review).toContainText('Accepted free-text solution')
      await preview(5, 'Didactic standalone content')
      await expect(
        studentPreview.getByTestId('content-element-0')
      ).toBeVisible()
      await preview(6, 'Didactic flashcard front')
      await expect(
        studentPreview.getByTestId('flashcard-front-0')
      ).toBeVisible()
      await expect(review).toContainText('Didactic flashcard answer')
      await preview(7, 'Didactic selection content')
      await expect(
        studentPreview.locator('#selection-0-field-0 input')
      ).toBeVisible()
      await expect(
        studentPreview.locator('#selection-0-field-1 input')
      ).toBeVisible()
      await expect(review).toContainText('Didactic Selection Pool 1')
      const selectionPool = review.getByTestId('element-import-answer-pool')
      await expect(selectionPool.locator('ol > li')).toHaveCount(0)
      await selectionPool.locator('summary').click()
      const selectionPoolPage = selectionPool.getByTestId(
        'element-import-answer-pool-page'
      )
      await expect(selectionPoolPage).toHaveAttribute('tabindex', '0')
      await expect(selectionPoolPage.locator(':scope > li')).toHaveCount(100)
      await selectionPool.getByTestId('element-import-answer-pool-next').click()
      await expect(selectionPoolPage.locator(':scope > li')).toHaveCount(1)
      await expect(selectionPoolPage).toContainText(
        'Didactic Selection Pool 101'
      )
      await preview(8, 'Didactic case-study instructions')
      await expect(studentPreview.getByTestId('case-0-title')).toContainText(
        'Case Alpha'
      )
      await expect(
        studentPreview.getByTestId('cs-slider-0-0-0-0')
      ).toBeVisible()
      await expect(review).toContainText('Quality criterion')
      await expect(review).toContainText('Case Alpha description')
      await expect(review).toContainText(
        'Didactic Pool A / Quality criterion: 4 – 8'
      )
      const caseStudyPool = review.getByTestId('element-import-answer-pool')
      await expect(caseStudyPool.locator('ol > li')).toHaveCount(0)
      await caseStudyPool.locator('summary').click()
      await expect(caseStudyPool).toContainText('Didactic Pool C')
      await expect(
        caseStudyPool
          .getByTestId('element-import-answer-pool-page')
          .locator(':scope > li')
      ).toHaveCount(3)
    }
  )

  importExportTest(
    'A 100-element review records interaction performance evidence',
    async ({ page }, testInfo) => {
      const fakeUploadURL = new URL(
        '/fake-element-package-upload',
        process.env.URL_MANAGE ?? URL_MANAGE
      ).toString()
      let validationRun = 0
      const validationSentAt = new Map<number, number>()

      await page.route('**/fake-element-package-upload', async (route) => {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ replayed: false }),
        })
      })
      await page.route('**/api/graphql*', async (route) => {
        const request = route.request()
        if (isGraphqlOperation(request, 'PrepareElementImportPackageUpload')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                prepareElementImportPackageUpload: {
                  uploadURL: fakeUploadURL,
                  uploadCapability: 'playwright-performance-capability',
                  artifactId: randomUUID(),
                  expiresAt: new Date(Date.now() + 60_000).toISOString(),
                },
              },
            }),
          })
          return
        }
        if (isGraphqlOperation(request, 'ValidateElementImportPackage')) {
          validationRun += 1
          const run = validationRun
          const entryCounts =
            run === 1 ? [2000, 2000, 1000] : Array(50).fill(100)
          const answerCollections = entryCounts.map(
            (entryCount, collectionIndex) => ({
              ref:
                collectionIndex === 0
                  ? 'performance-collection-reused'
                  : `performance-collection-${run}-${collectionIndex + 1}`,
              name: `Performance collection ${run}-${collectionIndex + 1}`,
              description: `Performance collection description ${collectionIndex + 1}`,
              alreadyImported: false,
              existingAnswerCollectionId: null,
              existingAnswerCollectionName: null,
              entries: Array.from({ length: entryCount }, (_, entryIndex) => ({
                id: collectionIndex * 10_000 + entryIndex + 1,
                value: `Performance entry ${collectionIndex + 1}-${entryIndex + 1}`,
              })),
            })
          )
          const elements = Array.from({ length: 100 }, (_, index) => {
            const collectionIndex = run === 1 ? 0 : index % 50
            const collection = answerCollections[collectionIndex]!

            return {
              ref: `performance-${run}-${index + 1}`,
              name: `Performance ${run}-${index + 1}`,
              content: `Performance content ${index + 1}`,
              type: 'SELECTION',
              options: {
                __typename: 'ElementImportPackagePreviewSelectionOptions',
                type: 'SELECTION',
                hasSampleSolution: true,
                numberOfInputs: 1,
              },
              pointsMultiplier: 1,
              basePoints: false,
              explanation: null,
              status: 'REVIEW',
              alreadyImported: index < 50,
              existingElementId: null,
              existingElementName:
                index < 50 ? `Existing performance ${index + 1}` : null,
              answerCollectionId: null,
              answerCollectionRef: collection.ref,
              answerCollectionItemIds: [collection.entries[0]!.id],
            }
          })
          validationSentAt.set(run, performance.now())
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                validateElementImportPackage: {
                  importToken: `playwright-performance-token-${run}`,
                  warnings: [],
                  errors: [],
                  answerCollections,
                  elements,
                },
              },
            }),
          })
          return
        }

        await route.continue()
      })

      await openImportPackageModal(page)
      const reviewDurations: number[] = []
      const bulkDurations: number[] = []
      for (let run = 1; run <= 5; run += 1) {
        await page
          .getByTestId('element-import-dropzone')
          .locator('input[type="file"]')
          .setInputFiles({
            name: `performance-${run}.zip`,
            mimeType: 'application/zip',
            buffer: Buffer.from(`PK\u0003\u0004performance-${run}`),
          })
        await expect(page.getByTestId('element-import-0')).toContainText(
          `Performance ${run}-1`
        )
        await expect(
          page
            .getByTestId('element-import-selection-list')
            .locator(':scope > li')
        ).toHaveCount(100)
        await expect(
          page.getByTestId('element-import-duplicate-summary')
        ).toContainText('50 selected elements')
        const collectionOverview = page.getByTestId(
          'element-import-answer-collections-overview'
        )
        await expect(
          collectionOverview.locator(
            '[data-cy^="element-package-answer-collection-"]'
          )
        ).toHaveCount(run === 1 ? 1 : 50)
        await expect(collectionOverview.locator('ol > li')).toHaveCount(0)
        const sentAt = validationSentAt.get(run)
        expect(sentAt).toBeDefined()
        const reviewDuration = performance.now() - sentAt!
        reviewDurations.push(reviewDuration)

        if (run === 1) {
          const collection = collectionOverview.locator(
            '[data-cy="element-package-answer-collection-0"]'
          )
          const summary = collection.locator('summary')
          await summary.click()
          const entryPage = collection.getByTestId(
            'element-package-answer-collection-entry-page'
          )
          await expect(entryPage).toHaveAttribute('data-total-entries', '2000')
          await expect(entryPage.locator(':scope > li')).toHaveCount(100)
          await expect(entryPage.locator(':scope > li').first()).toContainText(
            'Performance entry 1-1'
          )
          await collection
            .getByTestId('element-package-answer-collection-next')
            .click()
          await expect(entryPage.locator(':scope > li').first()).toContainText(
            'Performance entry 1-101'
          )
          await summary.press('Enter')
          await expect(entryPage).not.toBeAttached()
        } else if (run === 2) {
          const collection = collectionOverview.locator(
            '[data-cy="element-package-answer-collection-0"]'
          )
          const summary = collection.locator('summary')
          await summary.click()
          const entryPage = collection.getByTestId(
            'element-package-answer-collection-entry-page'
          )
          await expect(entryPage).toHaveAttribute('data-total-entries', '100')
          await expect(entryPage.locator(':scope > li')).toHaveCount(100)
          await expect(entryPage.locator(':scope > li').first()).toContainText(
            'Performance entry 1-1'
          )
          await summary.press('Enter')
          await expect(entryPage).not.toBeAttached()
        }

        const bulkStartedAt = performance.now()
        await page.getByTestId('element-import-exclude-duplicates').click()
        await expect(
          page.getByTestId('element-import-selection-summary')
        ).toContainText('50 elements selected')
        await expect(
          page.getByTestId('element-import-duplicate-summary')
        ).not.toBeAttached()
        const bulkDuration = performance.now() - bulkStartedAt
        bulkDurations.push(bulkDuration)
        await page.getByTestId('element-import-select-none').click()
      }

      const summarize = (values: number[]) => ({
        median: [...values].sort((a, b) => a - b)[
          Math.floor(values.length / 2)
        ],
        worst: Math.max(...values),
        measurements: values,
      })
      const performanceSummary = {
        reviewMs: summarize(reviewDurations),
        bulkToggleMs: summarize(bulkDurations),
      }
      console.info(
        `[element-import-performance] ${JSON.stringify(performanceSummary)}`
      )
      await testInfo.attach('element-import-100-performance.json', {
        body: Buffer.from(JSON.stringify(performanceSummary, null, 2)),
        contentType: 'application/json',
      })
    }
  )
}
