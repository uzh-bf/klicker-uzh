import { expect, test } from '../util/fixtures.js'
import { getPrisma } from '../global-setup.js'
import { URL_MANAGE, USER_ID_TEST } from '../util/constants.js'
import {
  cleanupQuestionGenerationReviewFixture,
  seedQuestionGenerationReviewFixture,
} from '../util/fixtures/questionGenerationReview.js'
import { gotoCommit } from '../util/workflow.js'

const FIXTURE_PREFIX = 'Synthetic question-generation review fixture'

test.describe('Generated element review inbox', () => {
  test('reviews synthetic generated elements through the canonical editor', async ({
    loginLecturer,
    page,
  }) => {
    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE

    try {
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
        await typeEditor.getByTestId('close-element-modal').click()
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

      const prisma = await getPrisma()
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

      const roundTripTypes = ['MC', 'KPRIM', 'FLASHCARD'] as const
      for (const type of roundTripTypes) {
        const draftId = fixture.draftIdsByType[type]
        await review.getByTestId(`element-generation-open-${draftId}`).click()
        const roundTripEditor = page.getByRole('dialog')
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
        if (draft.elementType === 'FLASHCARD') {
          expect(draft.savedElement.basePoints).toBe(false)
          expect(draft.savedElement.options).toEqual({})
        } else {
          const options = draft.savedElement.options as {
            choices: unknown[]
          }
          expect(options.choices).toHaveLength(
            draft.elementType === 'MC' ? 5 : 4
          )
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
      await cleanupQuestionGenerationReviewFixture()
    }
  })
})
