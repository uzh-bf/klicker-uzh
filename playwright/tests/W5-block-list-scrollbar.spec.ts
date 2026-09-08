import { expect, type Locator } from '@playwright/test'
import { cleanupTest } from '../util/cleanup.js'
import { USER_ID_TEST } from '../util/constants.js'
import { test } from '../util/fixtures.js'
import { createQuestionSC } from '../util/fixtures/elements.js'

test('CLEANUP', cleanupTest)

// Overlay scrollbars are platform dependent and may be hidden in headless
// browsers. Check physical clearance as well as clickability: a successful
// click alone would also pass on the original, overlapping layout.
async function expectScrollbarClearance(row: Locator) {
  await row.scrollIntoViewIfNeeded()
  await expect
    .poll(() =>
      row.evaluate((element) => {
        const list = element.parentElement!
        const bounds = list.getBoundingClientRect()
        return Array.from(element.querySelectorAll('button')).every(
          (button) => {
            const rect = button.getBoundingClientRect()
            const hit = document.elementFromPoint(
              rect.x + rect.width / 2,
              rect.y + rect.height / 2
            )
            return (
              rect.width > 0 &&
              rect.left >= bounds.left &&
              // Leave room for a typical 15px overlay scrollbar, regardless
              // of whether this browser currently paints one.
              bounds.right - rect.right >= 15 &&
              rect.top >= bounds.top - 1 &&
              rect.bottom <= bounds.bottom + 1 &&
              hit !== null &&
              button.contains(hit)
            )
          }
        )
      })
    )
    .toBe(true)
}

test('overflowing block keeps reorder and trash buttons clear of the scrollbar', async ({
  page,
  loginLecturer,
}) => {
  const titles = Array.from(
    { length: 7 },
    (_, i) => `Scrollbar ${i + 1} - a long element title that must truncate`
  )
  for (const name of titles) {
    await createQuestionSC({
      name,
      content: 'Synthetic scrollbar regression question',
      choices: [{ value: 'First' }, { value: 'Second' }],
      userId: USER_ID_TEST,
    })
  }

  await loginLecturer()
  await page.getByTestId('create-live-quiz').click()
  await page.getByTestId('insert-live-quiz-name').fill('Scrollbar regression')
  await page.getByTestId('next-or-submit').click()
  await page
    .getByTestId('insert-live-display-name')
    .fill('Scrollbar regression')
  await page.getByTestId('next-or-submit').click()
  await page.getByTestId('next-or-submit').click()
  await expect(page.getByTestId('block-container-header')).toHaveCount(1)

  for (const title of titles.slice(0, 6)) {
    await page.getByTestId(`element-checkbox-${title}`).check()
  }
  await page.getByTestId('add-selection-to-existing-container').click()

  const rows = page.getByTestId(/^element-\d+-block-0$/)
  await expect(rows).toHaveCount(6)
  const list = rows.first().locator('..')
  const spareCheckbox = page.getByTestId(`element-checkbox-${titles[6]}`)

  // Selection reduces the list height; both sizes must remain scrollable
  // without placing any of the row actions underneath the scrollbar.
  for (const selectionActive of [false, true]) {
    await spareCheckbox.setChecked(selectionActive)
    await expect
      .poll(() => list.evaluate((el) => el.scrollHeight > el.clientHeight))
      .toBe(true)
    for (let index = 0; index < 6; index++) {
      await expectScrollbarClearance(rows.nth(index))
    }
  }
  await spareCheckbox.uncheck()

  const lastTitle = await rows.nth(5).innerText()
  const previousTitle = await rows.nth(4).innerText()
  await page.getByTestId('move-element-5-block-0-up').click()
  await expect(rows.nth(4)).toHaveText(lastTitle)
  await expect(rows.nth(5)).toHaveText(previousTitle)
  await page.getByTestId('move-element-4-block-0-down').click()
  await expect(rows.nth(5)).toHaveText(lastTitle)
  await expect(rows.nth(4)).toHaveText(previousTitle)

  await expectScrollbarClearance(rows.nth(5))
  await expect
    .poll(() => list.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0)
  await page.getByTestId('remove-element-5-block-0').click()
  await expect(rows).toHaveCount(5)
  await expect(rows.filter({ hasText: lastTitle })).toHaveCount(0)
  await expect(rows.nth(4)).toHaveText(previousTitle)
})
