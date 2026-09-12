import type { Locator, Page } from '@playwright/test'
import { expect, test } from '../util/fixtures.js'
import { selectOption } from '../util/fixtures/activities.js'
import {
  addAnswerChoices,
  fillEditorField,
  switchElementType,
} from '../util/fixtures/elements.js'
import { elementTypeLabels } from '../util/messages.js'

test.use({ video: 'off' })

const MOBILE_VIEWPORT = { width: 390, height: 844 }
const DESKTOP_VIEWPORT = { width: 1440, height: 900 }

const SC_CHOICES = [
  'First option ![Synthetic image](/user-solid.svg) [Synthetic link](#preview-link)',
  'Second option',
  'Third option',
  'Fourth option',
]
const MC_CHOICES = [
  'First option',
  'Second option',
  'Third option',
  'Fourth option',
]
const KPRIM_CHOICES = [
  'First statement',
  'Second statement',
  'Third statement',
  'Fourth statement',
]

async function createUnsavedPreview(
  page: Page,
  {
    name,
    typeLabel,
    choices,
  }: {
    name: string
    typeLabel: string
    choices: string[]
  }
) {
  await expect(page.getByTestId('create-question')).toBeVisible()
  await page.getByTestId('create-question').click()

  if (typeLabel !== elementTypeLabels.singleChoice) {
    await switchElementType(page, typeLabel)
  }

  await page.getByTestId('insert-question-title').fill(name)
  await fillEditorField(
    page,
    'insert-question-text',
    'Synthetic preview prompt'
  )
  await addAnswerChoices(page, choices)

  const preview = page.getByTestId('student-element-preview')
  await expect(preview).toBeVisible()
  return preview
}

async function selectGridDisplayMode(page: Page) {
  await selectOption(page, '[data-cy="select-display-mode"]', 'Display as grid')
}

async function expectNoHorizontalOverflow(preview: Locator) {
  const previewDimensions = await preview.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  expect(previewDimensions.scrollWidth).toBeLessThanOrEqual(
    previewDimensions.clientWidth
  )
}

async function expectStackedOptions(options: Locator) {
  const first = await options.nth(0).boundingBox()
  const second = await options.nth(1).boundingBox()
  expect(first).not.toBeNull()
  expect(second).not.toBeNull()
  expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.height)
}

async function expectDesktopGrid(options: Locator) {
  const first = await options.nth(0).boundingBox()
  const second = await options.nth(1).boundingBox()
  expect(first).not.toBeNull()
  expect(second).not.toBeNull()
  expect(second!.x).toBeGreaterThan(first!.x)
  expect(Math.abs(second!.y - first!.y)).toBeLessThanOrEqual(2)
}

async function expectUnpressed(options: Locator) {
  for (let ix = 0; ix < (await options.count()); ix++) {
    await expect(options.nth(ix)).toHaveAttribute('aria-pressed', 'false')
  }
}

test.describe('Lecturer element preview mobile controls', () => {
  test.use({
    viewport: MOBILE_VIEWPORT,
    isMobile: true,
    hasTouch: true,
  })

  test('keeps single-choice preview selection exclusive with nested content', async ({
    loginLecturer,
    page,
  }, testInfo) => {
    await page.setViewportSize(DESKTOP_VIEWPORT)
    await loginLecturer()
    const preview = await createUnsavedPreview(page, {
      name: 'Synthetic SC preview',
      typeLabel: elementTypeLabels.singleChoice,
      choices: SC_CHOICES,
    })
    await selectGridDisplayMode(page)

    const options = preview.locator('[data-cy^="sc-0-answer-option-"]')
    await expect(options).toHaveCount(SC_CHOICES.length)
    await expect(options.first()).toHaveAccessibleName(/\S/)
    await expectUnpressed(options)
    await expectNoHorizontalOverflow(preview)

    const firstOption = options.nth(0)
    const imageButton = preview.locator('button[aria-label]').first()
    const syntheticImages = page.locator('img[alt="Synthetic image"]')
    await expect(imageButton).toBeVisible()
    await expect(syntheticImages).toHaveCount(1)
    await expect(syntheticImages.first()).toHaveJSProperty('complete', true)
    expect(
      await syntheticImages
        .first()
        .evaluate((image: HTMLImageElement) => image.naturalWidth)
    ).toBeGreaterThan(0)
    await imageButton.focus()
    await page.keyboard.press('Enter')
    await expect(syntheticImages).toHaveCount(2)
    await expect(syntheticImages.last().locator('..')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(syntheticImages).toHaveCount(1)
    await expect(imageButton).toBeFocused()
    await expect(firstOption).toHaveAttribute('aria-pressed', 'false')

    const previewLink = preview.locator('a[href="#preview-link"]')
    await expect(previewLink).toBeVisible()
    if ((await previewLink.getAttribute('target')) === '_blank') {
      const popupPromise = page.waitForEvent('popup')
      await previewLink.click()
      const popup = await popupPromise
      await popup.close()
    } else {
      await previewLink.click()
      await expect(page).toHaveURL(/#preview-link$/)
    }
    await expect(firstOption).toHaveAttribute('aria-pressed', 'false')

    await firstOption.click()
    await expect(firstOption).toHaveAttribute('aria-pressed', 'true')
    await expect(options.nth(1)).toHaveAttribute('aria-pressed', 'false')
    await options.nth(1).focus()
    await page.keyboard.press('Space')
    await expect(firstOption).toHaveAttribute('aria-pressed', 'false')
    await expect(options.nth(1)).toHaveAttribute('aria-pressed', 'true')

    await expectNoHorizontalOverflow(preview)
    await expectDesktopGrid(options)
    await preview.screenshot({
      path: testInfo.outputPath('preview-desktop.png'),
    })
  })

  test('keeps multiple-choice preview selections independent across viewports', async ({
    loginLecturer,
    page,
  }, testInfo) => {
    await loginLecturer()
    const preview = await createUnsavedPreview(page, {
      name: 'Synthetic MC preview',
      typeLabel: elementTypeLabels.multipleChoice,
      choices: MC_CHOICES,
    })
    await selectGridDisplayMode(page)

    const options = preview.locator('[data-cy^="mc-0-answer-option-"]')
    await expect(options).toHaveCount(MC_CHOICES.length)
    await expect(options.first()).toHaveAccessibleName(/\S/)
    await expectUnpressed(options)
    await expectNoHorizontalOverflow(preview)
    await expectStackedOptions(options)

    await options.nth(0).click()
    await expect(options.nth(0)).toHaveAttribute('aria-pressed', 'true')
    await options.nth(1).focus()
    await page.keyboard.press('Space')
    await expect(options.nth(0)).toHaveAttribute('aria-pressed', 'true')
    await expect(options.nth(1)).toHaveAttribute('aria-pressed', 'true')
    await options.nth(0).click()
    await expect(options.nth(0)).toHaveAttribute('aria-pressed', 'false')
    await expect(options.nth(1)).toHaveAttribute('aria-pressed', 'true')

    await preview.screenshot({
      path: testInfo.outputPath('preview-mobile.png'),
    })
    await page.setViewportSize(DESKTOP_VIEWPORT)
    await expectNoHorizontalOverflow(preview)
    await expectDesktopGrid(options)
    await preview.screenshot({
      path: testInfo.outputPath('preview-desktop.png'),
    })
  })

  test('starts KPRIM preview unanswered and supports keyboard toggles', async ({
    loginLecturer,
    page,
  }, testInfo) => {
    await loginLecturer()
    const preview = await createUnsavedPreview(page, {
      name: 'Synthetic KPRIM preview',
      typeLabel: elementTypeLabels.kprim,
      choices: KPRIM_CHOICES,
    })

    const rows = preview.getByTestId('kp-answer-options')
    await expect(rows).toHaveCount(KPRIM_CHOICES.length)
    await expectNoHorizontalOverflow(preview)

    for (let ix = 0; ix < KPRIM_CHOICES.length; ix++) {
      const correct = preview.getByTestId(`toggle-kp-0-answer-${ix}-correct`)
      const incorrect = preview.getByTestId(
        `toggle-kp-0-answer-${ix}-incorrect`
      )
      await expect(correct).toHaveAccessibleName(/\S/)
      await expect(incorrect).toHaveAccessibleName(/\S/)
      await expect(correct).toHaveAttribute('aria-pressed', 'false')
      await expect(incorrect).toHaveAttribute('aria-pressed', 'false')
    }

    const firstCorrect = preview.getByTestId('toggle-kp-0-answer-0-correct')
    const firstIncorrect = preview.getByTestId('toggle-kp-0-answer-0-incorrect')
    await firstCorrect.focus()
    await page.keyboard.press('Enter')
    await expect(firstCorrect).toHaveAttribute('aria-pressed', 'true')
    await expect(firstIncorrect).toHaveAttribute('aria-pressed', 'false')
    await firstIncorrect.focus()
    await page.keyboard.press('Space')
    await expect(firstCorrect).toHaveAttribute('aria-pressed', 'false')
    await expect(firstIncorrect).toHaveAttribute('aria-pressed', 'true')
    await preview.screenshot({
      path: testInfo.outputPath('preview-mobile.png'),
    })
  })
})
