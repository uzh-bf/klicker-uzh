import type { Page } from '@playwright/test'
import { COURSE_ID_TEST, USER_ID_TEST } from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'
import {
  createLiveQuiz,
  deleteLiveQuiz,
  publishLiveQuiz,
} from '../util/fixtures/manage.js'
import { openStudentLiveQuiz } from '../util/workflow.js'

const YOUTUBE_ID = 'dQw4w9WgXcQ'
const KALTURA_ID = '0_ipqc15ga'
const YOUTUBE_EMBED = `https://www.youtube.com/embed/${YOUTUBE_ID}`
const KALTURA_EMBED =
  `https://api.cast.switch.ch/p/106/embedPlaykitJs/uiconf_id/23449004/partner_id/106` +
  `?iframeembed=true&playerId=kaltura_player&entry_id=${KALTURA_ID}`
const CUSTOM_KALTURA_EMBED =
  'https://api.cast.switch.ch/p/123/embedPlaykitJs/uiconf_id/987654/partner_id/123' +
  '?iframeembed=true&playerId=kaltura_player&entry_id=0_um01ms1s'
const VIDEO_MARKDOWN = [
  `[video](https://www.youtube.com/watch?v=${YOUTUBE_ID})`,
  '. It should render a responsive player wrapper with the YouTube iframe.',
  'Embed a Kaltura video using the hosted portal URL layout',
  '[embed](https://uzh.mediaspace.cast.switch.ch/media/10+Untersuchung+Kopf+beim+Hund/0_ipqc15ga/124135)',
  '. It should resolve the entryId and render the Kaltura player iframe.',
  'Embed a Kaltura video using the raw embed code iframe URL',
  '[video](https://api.cast.switch.ch/p/123/embedPlaykitJs/uiconf_id/987654?iframeembed=true&entry_id=0_um01ms1s)',
  '. It should preserve the correct uiConfId and render the player.',
  'Ensure other link configurations, e.g.,',
  `[YouTube link](https://www.youtube.com/watch?v=${YOUTUBE_ID})`,
].join('\n')

async function blockPlayers(page: Page) {
  await page.route('https://www.youtube.com/**', (route) => route.abort())
  await page.route('https://api.cast.switch.ch/**', (route) => route.abort())
}

test.describe('Markdown video embeds', () => {
  test('renders valid, responsive players in the element editor', async ({
    loginLecturer,
    page,
  }) => {
    await blockPlayers(page)
    await loginLecturer()
    await page.getByTestId('create-question').click()

    const editor = page.getByTestId('insert-question-text')
    await editor.fill(VIDEO_MARKDOWN)
    await expect(editor).toContainText('YouTube link')

    const preview = page.getByTestId('student-element-preview')
    const players = preview.locator('iframe')
    await expect(players).toHaveCount(3)
    await expect(players.nth(0)).toHaveAttribute('src', YOUTUBE_EMBED)
    await expect(players.nth(0)).toHaveAttribute(
      'title',
      'YouTube video player'
    )
    await expect(players.nth(1)).toHaveAttribute('src', KALTURA_EMBED)
    await expect(players.nth(2)).toHaveAttribute('src', CUSTOM_KALTURA_EMBED)
    const ordinaryLink = preview.getByRole('link', { name: 'YouTube link' })
    await expect(preview.locator('a')).toHaveCount(1)
    await expect(ordinaryLink).toBeVisible()
    await expect(ordinaryLink).toHaveAttribute('target', '_blank')
    await expect(preview.locator('p > span > iframe')).toHaveCount(3)
    await expect(preview.locator('p > div')).toHaveCount(0)

    const dimensions = await preview.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
  })

  test('renders both providers without horizontal overflow in the mobile PWA', async ({
    loginStudent,
    page,
  }, testInfo) => {
    const suffix = `${testInfo.workerIndex}-${Date.now()}`
    const name = `Video Embed PWA ${suffix}`
    let liveQuizId: string | undefined

    await blockPlayers(page)
    try {
      liveQuizId = await createLiveQuiz({
        name,
        displayName: name,
        description: VIDEO_MARKDOWN,
        courseId: COURSE_ID_TEST,
        ownerId: USER_ID_TEST,
        elementNames: [],
      })
      await publishLiveQuiz(liveQuizId)

      await page.setViewportSize({ width: 375, height: 812 })
      await loginStudent()
      await openStudentLiveQuiz(page, name)

      const description = page.getByTestId('live-quiz-description')
      const players = description.locator('iframe')
      await expect(players).toHaveCount(3)
      await expect(players.nth(0)).toHaveAttribute('src', YOUTUBE_EMBED)
      await expect(players.nth(1)).toHaveAttribute('src', KALTURA_EMBED)
      const ordinaryLink = description.getByRole('link', {
        name: 'YouTube link',
      })
      await expect(description.locator('a')).toHaveCount(1)
      await expect(ordinaryLink).toBeVisible()
      await expect(ordinaryLink).toHaveAttribute('target', '_blank')
      await expect(description.locator('p > span > iframe')).toHaveCount(3)
      await expect(description.locator('p > div')).toHaveCount(0)

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth
      )
      expect(overflow).toBeLessThanOrEqual(0)
    } finally {
      if (liveQuizId) {
        await deleteLiveQuiz(liveQuizId)
      }
    }
  })
})
