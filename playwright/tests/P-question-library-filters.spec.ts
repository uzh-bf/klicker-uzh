import { ElementStatus } from '@klicker-uzh/prisma/client'
import { getPrisma } from '../global-setup.js'
import { LECTURER_ID } from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'
import { createQuestionMC } from '../util/fixtures/elements.js'

const STATUS_HEADER = 'collapse-tag-header-status'
const TYPES_HEADER = 'collapse-tag-header-types'
const MULTIPLIER_HEADER = 'collapse-tag-header-multiplier'
const GAMIFICATION_HEADER = 'collapse-tag-header-gamification'
const RESET_BUTTON = 'reset-question-pool-filters'
const STATUS_CASES = [
  { status: ElementStatus.DRAFT, label: 'Draft' },
  { status: ElementStatus.REVIEW, label: 'Review' },
  { status: ElementStatus.READY, label: 'Ready' },
] as const

test.describe('Question library filter groups', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  test('keeps several groups open, marks applied groups, and clears on reset', async ({
    page,
  }) => {
    // Status opens by default, without a marker while nothing is applied.
    // The advanced groups start collapsed.
    await expect(page.getByTestId(STATUS_HEADER)).toHaveAttribute(
      'data-state',
      'open'
    )
    await expect(page.getByTestId(`${STATUS_HEADER}-applied`)).toHaveCount(0)
    await expect(page.getByTestId(MULTIPLIER_HEADER)).toHaveAttribute(
      'data-state',
      'closed'
    )
    await expect(page.getByTestId(GAMIFICATION_HEADER)).toHaveAttribute(
      'data-state',
      'closed'
    )

    // Apply one filter in the Types group and one in the Multiplier group,
    // opening the second group without collapsing the first.
    await page.getByTestId(TYPES_HEADER).click()
    await page.getByTestId('element-type-filter-CONTENT').click()
    await expect(page.getByTestId(`${TYPES_HEADER}-applied`)).toBeVisible()

    await page.getByTestId(MULTIPLIER_HEADER).click()
    await page.getByTestId('multiplier-filter-1').click()
    await expect(page.getByTestId(`${MULTIPLIER_HEADER}-applied`)).toBeVisible()

    // Both groups stay open while their applied markers remain visible.
    await expect(page.getByTestId(TYPES_HEADER)).toHaveAttribute(
      'data-state',
      'open'
    )
    await expect(page.getByTestId(MULTIPLIER_HEADER)).toHaveAttribute(
      'data-state',
      'open'
    )

    // Reset clears every applied marker without changing group behavior.
    await page.getByTestId(RESET_BUTTON).click()
    await expect(page.getByTestId(`${TYPES_HEADER}-applied`)).toHaveCount(0)
    await expect(page.getByTestId(`${MULTIPLIER_HEADER}-applied`)).toHaveCount(
      0
    )
    await expect(page.getByTestId(STATUS_HEADER)).toHaveAttribute(
      'data-state',
      'open'
    )
  })

  for (const selectedCase of STATUS_CASES) {
    test(`filters actual results by ${selectedCase.label} status`, async ({
      page,
    }, testInfo) => {
      const prisma = await getPrisma()
      const names = STATUS_CASES.map(
        ({ label }) =>
          `W7 ${label} Filter ${selectedCase.status}-${testInfo.workerIndex}-${testInfo.retry}`
      )

      try {
        for (const [index, statusCase] of STATUS_CASES.entries()) {
          await createQuestionMC({
            name: names[index],
            content: `Element with ${statusCase.label} status`,
            choices: [{ value: 'Correct' }, { value: 'Incorrect' }],
            userId: LECTURER_ID,
          })
          await prisma.element.updateMany({
            where: { ownerId: LECTURER_ID, name: names[index] },
            data: { status: statusCase.status },
          })
        }

        await page.reload()
        await page
          .getByTestId(`element-status-filter-${selectedCase.status}`)
          .click()

        for (const [index, statusCase] of STATUS_CASES.entries()) {
          const result = page.getByTestId(`element-item-${names[index]}`)
          if (statusCase.status === selectedCase.status) {
            await expect(result).toBeVisible()
          } else {
            await expect(result).toHaveCount(0)
          }
        }
      } finally {
        await prisma.element.deleteMany({
          where: { ownerId: LECTURER_ID, name: { in: names } },
        })
      }
    })
  }

  test('projects the Markdown-rich card preview to plain text while the tooltip keeps the rendered Markdown', async ({
    page,
  }, testInfo) => {
    const elementName = `W6 Markdown Preview ${testInfo.workerIndex}-${testInfo.retry}`
    await createQuestionMC({
      name: elementName,
      content: `## Understanding Financial Goals and Conflicts

The financial target triangle includes:
* **Profitability**
* Liquidity
* Security`,
      choices: [{ value: 'Correct' }, { value: 'Incorrect' }],
      userId: LECTURER_ID,
    })

    try {
      const search = page.getByTestId('elements-search-input')
      await search.fill(elementName)
      await search.press('Enter')

      const card = page.getByTestId(`element-item-${elementName}`)
      await expect(card).toBeVisible()

      // The visible two-line preview must read as plain text: heading and list
      // wording survive, but Markdown controls are gone.
      await expect(card).toContainText(
        'Understanding Financial Goals and Conflicts'
      )
      await expect(card).toContainText('Profitability')
      await expect(card).not.toContainText('##')
      await expect(card).not.toContainText('**')

      // The hover/focus tooltip still renders the original stored Markdown: the
      // first heading appears as a real heading element in the tooltip content.
      await card
        .getByText(/Understanding Financial Goals and Conflicts/)
        .hover()
      await expect(
        page.locator('[role="tooltip"]').getByRole('heading', {
          name: 'Understanding Financial Goals and Conflicts',
        })
      ).toBeVisible()
    } finally {
      const prisma = await getPrisma()
      await prisma.element.deleteMany({ where: { name: elementName } })
    }
  })
})
