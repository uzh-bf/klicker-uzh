import { expect, test } from '../util/fixtures.js'
import { getPrisma } from '../global-setup.js'
import { URL_MANAGE, USER_ID_TEST } from '../util/constants.js'
import {
  cleanupQuestionGenerationReviewFixture,
  seedQuestionGenerationReviewFixture,
} from '../util/fixtures/questionGenerationReview.js'
import { fillAnswerField, fillEditorField } from '../util/fixtures/elements.js'
import { gotoCommit } from '../util/workflow.js'

const FIXTURE_PREFIX = 'Synthetic question-generation review fixture'

test.describe('Generated element review inbox', () => {
  test('reviews synthetic generated elements through the canonical editor', async ({
    loginLecturer,
    page,
  }) => {
    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    const prisma = await getPrisma()
    const previousAccess = await prisma.user.findUniqueOrThrow({
      where: { id: USER_ID_TEST },
      select: { aiFeaturesEnabled: true, betaEnabled: true },
    })

    try {
      await prisma.user.update({
        where: { id: USER_ID_TEST },
        data: { aiFeaturesEnabled: true, betaEnabled: true },
      })
      const fixture = await seedQuestionGenerationReviewFixture()
      await loginLecturer()

      await gotoCommit(
        page,
        `${manageUrl}/elements/generate?buildId=${fixture.primaryBuildId}`
      )
      const review = page.getByTestId('generated-element-review')
      await expect(review.locator('tbody tr')).toHaveCount(20)
      for (const type of [
        'Single choice',
        'Multiple choice',
        'KPRIM',
        'Flashcard',
      ]) {
        await expect(review).toContainText(type)
      }
      await expect(review).toContainText('Synthetic course website')
      await expect(review).toContainText('Synthetic course handout.pdf')
      await expect(review).toContainText('Website')
      await expect(review).toContainText('Document')
      await expect(review).toContainText('Page 7')
      await expect(review).toContainText('Page 12')
      await expect(review).toContainText('Learning design')
      await expect(review).toContainText('Bloom: Understand')
      await expect(review).toContainText('Difficulty: Medium')
      await expect(review).toContainText('Quality review recommended')
      await expect(review).toContainText('Updated')
      await expect(review).not.toContainText('.md')

      for (const [type, choiceCount] of [
        ['SC', 2],
        ['MC', 5],
        ['KPRIM', 4],
        ['FLASHCARD', 0],
      ] as const) {
        const draftId = fixture.draftIdsByType[type]
        await review.getByTestId(`element-generation-open-${draftId}`).click()
        const typeEditor = page.getByRole('dialog')
        await expect(
          typeEditor.getByTestId('insert-question-title')
        ).toBeVisible()
        await expect(
          typeEditor.getByTestId('insert-question-text')
        ).toBeVisible()
        await expect(
          typeEditor.getByTestId(/^insert-answer-field-/)
        ).toHaveCount(choiceCount)
        if (type === 'SC') {
          await typeEditor
            .getByTestId('insert-question-title')
            .fill(`${FIXTURE_PREFIX} unsaved close`)
          await typeEditor.getByTestId('close-element-modal').click()
          const discardChanges = page.getByRole('dialog', {
            name: 'Discard unsaved changes?',
          })
          await expect(discardChanges).toBeVisible()
          await discardChanges
            .getByTestId('cancel-discard-element-changes')
            .click()
          await expect(discardChanges).toBeHidden()
          await expect(typeEditor).toBeVisible()
          await typeEditor.getByTestId('close-element-modal').click()
          await discardChanges
            .getByTestId('confirm-discard-element-changes')
            .click()
        } else {
          await typeEditor.getByTestId('close-element-modal').click()
        }
        await expect(typeEditor).toBeHidden()
      }

      await expect(
        review.getByTestId('element-generation-filter-all')
      ).toHaveText('All (20)')
      await expect(
        review.getByTestId('element-generation-filter-open')
      ).toHaveText('Needs review (19)')
      await expect(
        review.getByTestId('element-generation-filter-attention')
      ).toHaveText('Needs attention (1)')
      await expect(
        review.getByTestId('element-generation-filter-kept')
      ).toHaveText('Kept (0)')
      await expect(
        review.getByTestId('element-generation-filter-discarded')
      ).toHaveText('Discarded (0)')

      const keepDraftId = fixture.primaryDraftIds[0]
      const discardDraftId = fixture.primaryDraftIds[1]
      const keepRow = review.getByTestId(`generated-element-row-${keepDraftId}`)
      const discardRow = review.getByTestId(
        `generated-element-row-${discardDraftId}`
      )

      await keepRow
        .getByTestId(`element-generation-open-${keepDraftId}`)
        .click()
      const editor = page.getByRole('dialog')
      await expect(editor.getByTestId('select-question-status')).toBeVisible()
      await expect(editor.getByTestId('insert-question-title')).toBeVisible()
      await expect(editor.getByTestId('insert-question-text')).toBeVisible()
      await expect(
        editor.getByTestId('generated-element-sources')
      ).toContainText('Page 7')
      await expect(
        editor.getByTestId('generated-element-sources')
      ).toContainText('Page 12')
      await expect(
        editor.getByTestId('generated-element-source-0')
      ).toHaveAttribute('href', 'https://example.invalid/synthetic-course')
      await expect(
        editor.getByTestId('generated-element-source-1')
      ).toHaveCount(0)
      await expect(
        editor.getByTestId('generated-element-sources')
      ).toContainText('Synthetic course handout.pdf')
      await expect(
        editor.getByTestId('generated-element-sources')
      ).toContainText('Document')

      const editedTitle = `${FIXTURE_PREFIX} SC 1 edited`
      await editor.getByTestId('insert-question-title').fill(editedTitle)
      await editor.getByTestId(`generated-element-keep-${keepDraftId}`).click()
      await expect(editor).toBeHidden()
      await expect(keepRow).toContainText('Kept')
      await expect(
        keepRow.getByTestId(`element-generation-open-saved-${keepDraftId}`)
      ).toHaveAttribute('href', /\?editElementId=\d+/)

      const savedElementDraft = await prisma.generatedElementDraft.findUnique({
        where: { id: keepDraftId },
        select: {
          savedElement: {
            select: {
              id: true,
              name: true,
              ownerId: true,
              type: true,
              status: true,
            },
          },
        },
      })
      const savedElement = savedElementDraft?.savedElement
      expect(savedElement).not.toBeNull()
      if (!savedElement) throw new Error('The kept draft has no saved element')
      expect(savedElement).toMatchObject({
        name: editedTitle,
        ownerId: USER_ID_TEST,
        type: 'SC',
        status: 'REVIEW',
      })
      const savedElementId = savedElement.id

      await discardRow
        .getByTestId(`element-generation-open-${discardDraftId}`)
        .click()
      const discardEditor = page.getByRole('dialog')
      await discardEditor
        .getByTestId(`generated-element-discard-${discardDraftId}`)
        .click()
      await expect(discardEditor).toBeHidden()
      await expect(discardRow).toContainText('Discarded')

      await review.getByTestId('element-generation-filter-kept').click()
      await expect(review.locator('tbody tr')).toHaveCount(1)
      await review.getByTestId('element-generation-filter-discarded').click()
      await expect(review.locator('tbody tr')).toHaveCount(1)
      await review
        .getByTestId(`element-generation-restore-${discardDraftId}`)
        .click()
      await review.getByTestId('element-generation-filter-all').click()
      await expect(review.locator('tbody tr')).toHaveCount(20)
      await expect(discardRow).toContainText('Needs review')

      const roundTripEdits = {
        MC: {
          content: 'Edited multiple-choice prompt',
          choice: 'Edited multiple-choice answer',
        },
        KPRIM: {
          content: 'Edited KPRIM prompt',
          choice: 'Edited KPRIM answer',
        },
        FLASHCARD: {
          content: 'Edited flashcard front',
          explanation: 'Edited flashcard back',
        },
      } as const
      const roundTripTypes = Object.keys(roundTripEdits) as Array<
        keyof typeof roundTripEdits
      >
      for (const type of roundTripTypes) {
        const draftId = fixture.draftIdsByType[type]
        await review.getByTestId(`element-generation-open-${draftId}`).click()
        const roundTripEditor = page.getByRole('dialog')
        const edit = roundTripEdits[type]
        await fillEditorField(page, 'insert-question-text', edit.content, true)
        if ('choice' in edit) {
          await fillAnswerField(page, 0, edit.choice, true)
          await roundTripEditor.getByTestId('set-correctness-0').press(' ')
          await expect(
            roundTripEditor.getByTestId('set-correctness-0')
          ).toHaveAttribute('aria-checked', 'false')
        } else {
          await fillEditorField(
            page,
            'insert-question-explanation',
            edit.explanation,
            true
          )
        }
        await roundTripEditor
          .getByTestId(`generated-element-keep-${draftId}`)
          .click()
        await expect(roundTripEditor).toBeHidden()
      }

      const roundTripDrafts = await prisma.generatedElementDraft.findMany({
        where: {
          id: {
            in: roundTripTypes.map((type) => fixture.draftIdsByType[type]),
          },
        },
        select: {
          elementType: true,
          savedElement: {
            select: {
              type: true,
              status: true,
              content: true,
              explanation: true,
              basePoints: true,
              options: true,
            },
          },
        },
      })
      for (const draft of roundTripDrafts) {
        expect(draft.savedElement).not.toBeNull()
        if (!draft.savedElement) {
          throw new Error(`${draft.elementType} was not persisted`)
        }
        expect(draft.savedElement).toMatchObject({
          type: draft.elementType,
          status: 'REVIEW',
        })
        if (
          draft.elementType !== 'MC' &&
          draft.elementType !== 'KPRIM' &&
          draft.elementType !== 'FLASHCARD'
        ) {
          throw new Error(`Unexpected round-trip type ${draft.elementType}`)
        }
        const edit = roundTripEdits[draft.elementType]
        expect(draft.savedElement.content).toContain(edit.content)
        if (draft.elementType === 'FLASHCARD') {
          expect(draft.savedElement.explanation).toContain(
            roundTripEdits.FLASHCARD.explanation
          )
          expect(draft.savedElement.basePoints).toBe(false)
          expect(draft.savedElement.options).toEqual({})
        } else {
          const options = draft.savedElement.options as {
            choices: Array<{ value: string; correct: boolean }>
          }
          expect(options.choices).toHaveLength(
            draft.elementType === 'MC' ? 5 : 4
          )
          expect(options.choices[0]).toMatchObject({
            // ContentInput serializes edited rich text as markdown and may keep
            // a trailing newline from an empty final editor block; rendering is
            // unaffected, so assert the value without trailing whitespace.
            value: expect.stringContaining(
              roundTripEdits[draft.elementType].choice
            ),
            correct: false,
          })
        }
      }

      await page.reload()
      const reloadedReview = page.getByTestId('generated-element-review')
      await expect(reloadedReview).toBeVisible()
      await expect(
        reloadedReview.getByTestId(`generated-element-row-${keepDraftId}`)
      ).toContainText('Kept')
      await expect(
        reloadedReview.getByTestId(`generated-element-row-${discardDraftId}`)
      ).toContainText('Needs review')
      const openSaved = reloadedReview
        .getByTestId(`generated-element-row-${keepDraftId}`)
        .getByTestId(`element-generation-open-saved-${keepDraftId}`)
      await expect(openSaved).toHaveAttribute(
        'href',
        `/?editElementId=${savedElementId}`
      )
      await openSaved.click()
      await expect(page).toHaveURL(
        new RegExp(`[?&]editElementId=${savedElementId}(?:&|$)`)
      )
      const savedEditor = page.getByRole('dialog')
      await expect(
        savedEditor.getByTestId('insert-question-title')
      ).toHaveValue(editedTitle)
    } finally {
      try {
        await cleanupQuestionGenerationReviewFixture()
      } finally {
        await prisma.user.update({
          where: { id: USER_ID_TEST },
          data: previousAccess,
        })
      }
    }
  })
})

test.describe('Background generation notifications', () => {
  test('keeps review, completion, partial, and failure outcomes distinct', async ({
    page,
    loginLecturer,
  }) => {
    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    const reviewBuildId = '00000000-0000-4000-8000-0000000000a1'
    const failedBuildId = '00000000-0000-4000-8000-0000000000a2'
    const partialBuildId = '00000000-0000-4000-8000-0000000000a3'
    const statusByBuildId = new Map<string, string>()
    let interceptedPolls = 0

    // The provider polls ElementGenerationBuild while a job is tracked, so the
    // notification lifecycle is driven with synthetic responses for that
    // operation only.
    await page.route('**/api/graphql**', async (route) => {
      const request = route.request()
      let operationName: string | undefined
      let variables: { id?: string } | undefined

      if (request.method() === 'GET') {
        const url = new URL(request.url())
        operationName = url.searchParams.get('operationName') ?? undefined
        const rawVariables = url.searchParams.get('variables')
        if (rawVariables) {
          variables = JSON.parse(rawVariables) as { id?: string }
        }
      } else {
        const body = request.postDataJSON() as {
          operationName?: string
          variables?: { id?: string }
        }
        operationName = body?.operationName
        variables = body?.variables
      }

      if (operationName !== 'ElementGenerationBuild') {
        await route.fallback()
        return
      }

      const buildId = variables?.id ?? ''
      const status = statusByBuildId.get(buildId)
      if (status === undefined) {
        // Builds are answered from the real backend unless a synthetic status
        // was registered for them.
        await route.fallback()
        return
      }

      interceptedPolls += 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'cache-control': 'no-store' },
        body: JSON.stringify({
          data: {
            elementGenerationBuild: {
              __typename: 'ElementGenerationBuild',
              id: buildId,
              status,
              generatedElementCount: 3,
              requestedElementCount: 4,
            },
          },
        }),
      })
    })

    await loginLecturer()
    await expect(page.getByTestId('element-library-sidebar')).toBeVisible({
      timeout: 20_000,
    })

    const preActionUrl = page.url()
    const tracker = page.getByTestId('generation-status')
    const toaster = page.getByLabel(/Notifications/)
    const toasts = toaster.locator('[data-sonner-toast]')
    const warningToasts = toaster.locator(
      '[data-sonner-toast][data-type="warning"]'
    )
    const successToasts = toaster.locator(
      '[data-sonner-toast][data-type="success"]'
    )
    const errorToasts = toaster.locator(
      '[data-sonner-toast][data-type="error"]'
    )
    const completeAction = successToasts.locator('button[data-action]')

    const startGeneration = (buildId: string) =>
      page.evaluate((id) => {
        window.dispatchEvent(
          new CustomEvent('klicker:generation-started', {
            detail: {
              kind: 'element',
              id,
              label: `Synthetic background build ${id}`,
              startedAt: Date.now(),
            },
          })
        )
      }, buildId)

    // A running build stays tracked and raises no notification, even after it
    // has been polled more than once.
    statusByBuildId.set(reviewBuildId, 'RUNNING')
    const pollsBeforeStart = interceptedPolls
    await startGeneration(reviewBuildId)
    await expect(tracker).toBeVisible({ timeout: 15_000 })
    await expect
      .poll(() => interceptedPolls, { timeout: 15_000 })
      .toBeGreaterThanOrEqual(pollsBeforeStart + 2)
    await expect(tracker).toBeVisible()
    await expect(toasts).toHaveCount(0)

    // Each approval gate pauses tracking without claiming completion.
    for (const status of [
      'WAITING_FOR_DESIGN_REVIEW',
      'WAITING_FOR_PLAN_REVIEW',
      'AWAITING_INCOMPLETE_PUBLICATION',
    ]) {
      statusByBuildId.set(reviewBuildId, status)
      await expect(tracker).toHaveCount(0, { timeout: 20_000 })
      await expect(toasts).toHaveCount(1)
      await expect(warningToasts).toHaveCount(1)
      await expect(warningToasts.locator('button[data-action]')).toHaveCount(1)
      await warningToasts.locator('button[data-close-button]').focus()
      await warningToasts.locator('button[data-close-button]').press('Enter')
      await expect(toasts).toHaveCount(0)
      statusByBuildId.set(reviewBuildId, 'RUNNING')
      await startGeneration(reviewBuildId)
      await expect(tracker).toBeVisible({ timeout: 15_000 })
    }

    // The same job can complete after re-registration by its caller.
    statusByBuildId.set(reviewBuildId, 'COMPLETED')
    await expect(tracker).toHaveCount(0, { timeout: 20_000 })
    await expect(toasts).toHaveCount(1)
    await expect(successToasts).toHaveCount(1)
    await expect(completeAction).toHaveCount(1)

    // A completion notification does not navigate on its own.
    await expect(page).toHaveURL(preActionUrl)

    await gotoCommit(page, manageUrl)
    await expect(page.getByTestId('element-library-sidebar')).toBeVisible({
      timeout: 20_000,
    })

    // A failed build reports an error without offering an action.
    statusByBuildId.set(failedBuildId, 'RUNNING')
    await startGeneration(failedBuildId)
    await expect(tracker).toBeVisible({ timeout: 15_000 })
    statusByBuildId.set(failedBuildId, 'FAILED')
    await expect(tracker).toHaveCount(0, { timeout: 20_000 })
    await expect(toasts).toHaveCount(1)
    await expect(errorToasts).toHaveCount(1)
    await expect(errorToasts.locator('button[data-action]')).toHaveCount(0)
    await expect(errorToasts.locator('button[data-close-button]')).toHaveCount(
      1
    )

    // A partial result is announced as an actionable, non-success outcome.
    statusByBuildId.set(partialBuildId, 'RUNNING')
    await startGeneration(partialBuildId)
    await expect(tracker).toBeVisible({ timeout: 15_000 })
    statusByBuildId.set(partialBuildId, 'INCOMPLETE')
    await expect(tracker).toHaveCount(0, { timeout: 20_000 })
    await expect(toasts).toHaveCount(2)
    await expect(warningToasts.locator('button[data-action]')).toHaveCount(1)

    // A notification for a real build completes against the real backend, so
    // its action can be followed to the fully rendered build page.
    const prisma = await getPrisma()
    const previousAccess = await prisma.user.findUniqueOrThrow({
      where: { id: USER_ID_TEST },
      select: { aiFeaturesEnabled: true, betaEnabled: true },
    })

    try {
      await prisma.user.update({
        where: { id: USER_ID_TEST },
        data: { aiFeaturesEnabled: true, betaEnabled: true },
      })
      const fixture = await seedQuestionGenerationReviewFixture()
      await startGeneration(fixture.primaryBuildId)
      await expect(successToasts).toHaveCount(1)
      await expect(completeAction).toHaveCount(1)
      await completeAction.focus()
      await completeAction.press('Enter')
      await expect(page).toHaveURL(
        new RegExp(`/elements/generate\\?buildId=${fixture.primaryBuildId}`)
      )
      await expect(page.getByTestId('element-generation-build')).toBeVisible({
        timeout: 20_000,
      })
    } finally {
      try {
        await cleanupQuestionGenerationReviewFixture()
      } finally {
        await prisma.user.update({
          where: { id: USER_ID_TEST },
          data: previousAccess,
        })
      }
    }
  })
})
