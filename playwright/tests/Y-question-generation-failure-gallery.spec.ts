import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '../util/fixtures.js'
import { getPrisma } from '../global-setup.js'
import { URL_MANAGE, USER_ID_TEST } from '../util/constants.js'
import {
  cleanupQuestionGenerationReviewFixture,
  seedQuestionGenerationReviewFixture,
} from '../util/fixtures/questionGenerationReview.js'
import { gotoCommit } from '../util/workflow.js'

// Reproducible captures of the settled question-generation failure surfaces.
// The spec is the capture entrypoint for the rs-build-screenshot-gallery
// manifest under project/_local/gallery; it also keeps the fixture honest by
// asserting each surface before it is photographed.
const GALLERY_DIRECTORY = fileURLToPath(
  new URL(
    '../../project/_local/gallery/question-generation-failure-visibility/',
    import.meta.url
  )
)

const LOCALES = ['en', 'de'] as const
type Locale = (typeof LOCALES)[number]

function galleryPath(name: string) {
  return GALLERY_DIRECTORY + name
}

test.describe('Question-generation failure surfaces', () => {
  // Eight routed navigations (four surfaces across two locales) exceed the
  // suite default; the capture spec owns a deterministic budget instead.
  test.describe.configure({ timeout: 240_000 })

  test('captures the settled failure, partial, legacy and zero-passing surfaces', async ({
    loginLecturer,
    page,
  }) => {
    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    const prisma = await getPrisma()
    const previousAccess = await prisma.user.findUniqueOrThrow({
      where: { id: USER_ID_TEST },
      select: { aiFeaturesEnabled: true, betaEnabled: true },
    })

    mkdirSync(GALLERY_DIRECTORY, { recursive: true })

    try {
      await prisma.user.update({
        where: { id: USER_ID_TEST },
        data: { aiFeaturesEnabled: true, betaEnabled: true },
      })
      const fixture = await seedQuestionGenerationReviewFixture()
      await loginLecturer()
      await page.setViewportSize({ width: 1440, height: 900 })

      for (const locale of LOCALES) {
        const prefix = locale === 'de' ? '/de' : ''
        const openBuild = async (buildId: string) => {
          await gotoCommit(
            page,
            manageUrl + prefix + '/elements/generate?buildId=' + buildId
          )
          await expect(
            page.getByTestId('element-generation-build')
          ).toBeVisible({ timeout: 20_000 })
          // A card grid that overflows horizontally would clip in a real
          // viewport; the capture is only representative when the page fits.
          const overflow = await page.evaluate(
            () =>
              document.documentElement.scrollWidth -
              document.documentElement.clientWidth
          )
          expect(overflow).toBeLessThanOrEqual(1)
        }

        // 1. A failed run that reported one reason per unsupported slot.
        await openBuild(fixture.failureBuildId)
        const failureCards = page.getByTestId('element-generation-slot-failure')
        await expect(failureCards).toHaveCount(4)
        await expect(
          page.getByTestId('element-generation-slot-failure-class-user_input')
        ).toHaveCount(2)
        await expect(
          page.getByTestId(
            'element-generation-slot-failure-class-self_repairable'
          )
        ).toHaveCount(1)
        await expect(
          page.getByTestId('element-generation-slot-failure-class-system')
        ).toHaveCount(1)
        await page.screenshot({
          path: galleryPath('01-failed-reasons-' + locale + '.png'),
          fullPage: true,
        })

        // 2. A partial run that delivered a passing subset plus attention
        //    cards, and one real interaction on the delivered draft.
        await openBuild(fixture.partialBuildId)
        await expect(page.getByTestId('generated-element-review')).toBeVisible()
        await expect(
          page.getByTestId('element-generation-partial-attention')
        ).toBeVisible()
        await expect(failureCards).toHaveCount(3)
        await page.screenshot({
          path: galleryPath('02-partial-delivery-' + locale + '.png'),
          fullPage: true,
        })

        if (locale === 'en') {
          await page
            .getByTestId(
              'element-generation-open-' + fixture.partialDeliveredDraftId
            )
            .click()
          const editor = page.getByRole('dialog')
          await expect(
            editor.getByTestId('insert-question-title')
          ).toBeVisible()
          await expect(editor.getByTestId('insert-question-text')).toBeVisible()
          await editor.getByTestId('close-element-modal').click()
          await expect(editor).toBeHidden()
        }

        // 3. A failed run without structured reasons: the legacy surface.
        await openBuild(fixture.legacyFailureBuildId)
        await expect(
          page.getByTestId('element-generation-failed-legacy')
        ).toBeVisible()
        await expect(failureCards).toHaveCount(0)
        await page.screenshot({
          path: galleryPath('03-legacy-failure-' + locale + '.png'),
          fullPage: true,
        })

        // 4. A partial run whose slots all failed: reasons, no drafts.
        await openBuild(fixture.zeroPassingBuildId)
        await expect(
          page.getByTestId('element-generation-partial-attention')
        ).toBeVisible()
        await expect(failureCards).toHaveCount(2)
        await expect(page.getByTestId('generated-element-review')).toHaveCount(
          0
        )
        await expect(
          page.getByTestId('element-generation-no-drafts')
        ).toHaveCount(0)
        await page.screenshot({
          path: galleryPath('04-zero-passing-' + locale + '.png'),
          fullPage: true,
        })
      }
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
