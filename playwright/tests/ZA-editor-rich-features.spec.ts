/**
 * ZA-editor-rich-features.spec.ts
 *
 * Tests Tiptap rich text editor features: formatting shortcuts,
 * GFM tables insertion, contextual menu additions,
 * syntax highlighted code blocks, and HTML rendering in frontend previews.
 */

import type { Locator } from '@playwright/test'
import { getPrisma } from '../global-setup.js'
import { cleanupTest } from '../util/cleanup.js'
import { URL_MANAGE } from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'
import {
  pasteEditorField,
  saveElement,
  searchAndEdit,
  setElementStatus,
  switchElementType,
} from '../util/fixtures/elements.js'
import { elementTypeLabels, statusLabels } from '../util/messages.js'

async function expectNormalizedPastedTable(rows: Locator) {
  await expect(rows).toHaveCount(4)
  await expect(rows.nth(0).locator('th, td')).toHaveText(['Header', 'Detail'])
  await expect(rows.nth(1).locator('th, td')).toHaveText(['Group', ''])
  await expect(rows.nth(2).locator('th, td')).toHaveText(['First', 'Second'])
  await expect(rows.nth(3).locator('th, td')).toHaveText(['', 'Third'])
}

test('CLEANUP', cleanupTest)

test.describe('Test Tiptap Editor Rich Text, Table, Code Block, and Preview Features', () => {
  test.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  test('Create rich content element and verify styles in editor and frontend', async ({
    page,
  }) => {
    const questionTitle = 'Tiptap Rich E2E Test Elements'

    // 1. Open the creation modal and set type to Content
    await page.getByTestId('create-question').click()
    await switchElementType(page, elementTypeLabels.content)
    await page.getByTestId('insert-question-title').fill(questionTitle)
    await setElementStatus(page, statusLabels.draft)

    // 2. Select the Tiptap editor viewport
    const editor = page.getByTestId('insert-question-text')
    const emptyEditorParagraph = editor.locator('p.is-editor-empty')
    await expect(emptyEditorParagraph).toHaveCount(1)
    await expect(emptyEditorParagraph).toHaveAttribute(
      'data-placeholder',
      'Enter your content here...'
    )
    await editor.scrollIntoViewIfNeeded()
    await editor.click()

    // 3. Test basic styling formatting (Bold/Italic)
    await editor.pressSequentially('Normal ')

    // Toggle Bold via keyboard shortcuts
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
    await page.keyboard.down(modifier)
    await page.keyboard.press('b')
    await page.keyboard.up(modifier)

    await editor.pressSequentially('Bold')

    // Toggle Bold off
    await page.keyboard.down(modifier)
    await page.keyboard.press('b')
    await page.keyboard.up(modifier)

    await editor.pressSequentially(' ')

    // Toggle Italic via shortcuts
    await page.keyboard.down(modifier)
    await page.keyboard.press('i')
    await page.keyboard.up(modifier)

    await editor.pressSequentially('Italic')

    // Toggle Italic off
    await page.keyboard.down(modifier)
    await page.keyboard.press('i')
    await page.keyboard.up(modifier)

    await editor.pressSequentially('\n')

    // Assert tags are present in the editor DOM
    await expect(editor.locator('strong')).toHaveText('Bold')
    await expect(editor.locator('em')).toHaveText('Italic')

    // 4. Test Table Creation & Contextual Toolbar
    const tableBtn = page.getByTestId('toolbar-table')
    await tableBtn.click()

    // Verify 3x3 table is rendered inside the editor
    const tableElement = editor.locator('table')
    await expect(tableElement).toBeVisible()
    await expect(tableElement.locator('tr')).toHaveCount(3)

    // Fill cell text and check focus actions
    const cellA1 = tableElement.locator('td').first()
    await cellA1.locator('p').click()
    await page.keyboard.type('CellA1')
    await expect(cellA1).toHaveText('CellA1')

    // Focused in a cell: verify the Markdown-safe contextual toolbar appears
    const addRowBtn = page.getByTestId('table-add-row')
    await expect(addRowBtn).toBeVisible()
    await expect(page.getByText('M/S', { exact: true })).toHaveCount(0)
    await expect(editor.locator('.column-resize-handle')).toHaveCount(0)

    // Click Add Row
    await addRowBtn.click()

    // Verify row count increases to 4
    await expect(tableElement.locator('tr')).toHaveCount(4)

    // Add a column and keep it through the Markdown save/preview round-trip
    await page.getByTestId('table-add-column').click()
    await expect(
      tableElement.locator('tr').first().locator('th, td')
    ).toHaveCount(4)

    // 5. Test syntax highlighting across the shared editor/preview language set
    // Click outside of table area in the editor to append text (target only top-level paragraphs)
    await editor.locator('> p').last().click()

    // Create code block via input rule: typing ```js followed by space/Enter
    await page.keyboard.type('```js ')
    await page.keyboard.type('const count = 99;')

    // Exit the JavaScript block, then add TypeScript and non-JS (R) blocks
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await page.keyboard.type('```ts ')
    await page.keyboard.type('const total: number = 42;')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await page.keyboard.type('```r ')
    await page.keyboard.type('increment <- function(x) { return(x + 1) }')

    // Verify Highlight.js token spans inside the editor
    const codeBlocks = editor.locator('pre code')
    await expect(codeBlocks).toHaveCount(3)

    const jsCodeBlock = codeBlocks.nth(0)
    await expect(jsCodeBlock.locator('span.hljs-keyword')).toHaveText('const')
    await expect(jsCodeBlock.locator('span.hljs-number')).toHaveText('99')

    const tsCodeBlock = codeBlocks.nth(1)
    await expect(tsCodeBlock.locator('span.hljs-keyword')).toHaveText('const')
    await expect(tsCodeBlock.locator('span.hljs-number')).toHaveText('42')

    const rCodeBlock = codeBlocks.nth(2)
    await expect(rCodeBlock.locator('span.hljs-keyword')).toHaveText('function')
    await expect(rCodeBlock.locator('span.hljs-built_in')).toHaveText('return')
    await expect(rCodeBlock.locator('span.hljs-number')).toHaveText('1')

    // 6. Save the content element
    await saveElement(page)

    // 7. Verify the saved content renders correctly in the frontend preview page (/questions/[id])
    // Search the database to retrieve the generated ID
    const prisma = await getPrisma()
    const dbQuestion = await prisma.element.findFirst({
      where: { name: questionTitle, isDeleted: false },
    })
    expect(dbQuestion).not.toBeNull()
    const questionId = dbQuestion!.id

    // Navigate to the direct element details preview page
    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    await page.goto(`${manageUrl}/questions/${questionId}`)

    const previewContainer = page.getByTestId('question-preview-container')
    await expect(previewContainer).toBeVisible()

    // Assert that the GFM table is styled and matches input text
    await expect(previewContainer.locator('table')).toBeVisible()
    await expect(previewContainer.locator('table tr')).toHaveCount(4)
    await expect(
      previewContainer.locator('table tr').first().locator('th, td')
    ).toHaveCount(4)
    await expect(previewContainer.locator('table td').first()).toContainText(
      'CellA1'
    )

    // Assert that all code blocks render with Prism token styling class names
    const previewCodeBlocks = previewContainer.locator('pre code')
    await expect(previewCodeBlocks).toHaveCount(3)

    const previewJsCodeBlock = previewCodeBlocks.nth(0)
    await expect(previewJsCodeBlock.locator('span.token.keyword')).toHaveText(
      'const'
    )
    await expect(previewJsCodeBlock.locator('span.token.number')).toHaveText(
      '99'
    )

    const previewTsCodeBlock = previewCodeBlocks.nth(1)
    await expect(previewTsCodeBlock.locator('span.token.keyword')).toHaveText(
      'const'
    )
    await expect(previewTsCodeBlock.locator('span.token.number')).toHaveText(
      '42'
    )

    const previewRCodeBlock = previewCodeBlocks.nth(2)
    await expect(previewRCodeBlock.locator('span.token.keyword')).toHaveText(
      'function'
    )
    await expect(previewRCodeBlock.locator('span.token.number')).toHaveText('1')

    // 8. Reopen the saved element and verify rich content survived Markdown
    await page.goto(manageUrl)
    await searchAndEdit(page, questionTitle)

    const reopenedEditor = page.getByTestId('insert-question-text')
    const reopenedTable = reopenedEditor.locator('table')
    await expect(reopenedTable.locator('tr')).toHaveCount(4)
    await expect(
      reopenedTable.locator('tr').first().locator('th, td')
    ).toHaveCount(4)
    await expect(reopenedEditor.locator('pre code')).toHaveCount(3)
  })

  test('Normalizes merged cells before persisting a pasted table', async ({
    page,
  }, testInfo) => {
    const questionTitle = `Tiptap Pasted Table E2E Test Element ${testInfo.workerIndex}-${Date.now()}`

    await page.getByTestId('create-question').click()
    await switchElementType(page, elementTypeLabels.content)
    await page.getByTestId('insert-question-title').fill(questionTitle)
    await setElementStatus(page, statusLabels.draft)

    await pasteEditorField(
      page,
      'insert-question-text',
      'Header\tDetail\nGroup\nFirst\tSecond\nThird',
      '<table><thead><tr><th rowspan="0">Header</th><th>Detail</th></tr></thead><tbody><tr><td colspan="2">Group</td></tr><tr><td rowspan="2">First</td><td>Second</td></tr><tr><td>Third</td></tr></tbody></table>'
    )

    const editor = page.getByTestId('insert-question-text')
    const pastedRows = editor.locator('table tr')
    await expectNormalizedPastedTable(pastedRows)
    await expect(
      editor.locator(
        'td[colspan]:not([colspan="1"]), th[colspan]:not([colspan="1"])'
      )
    ).toHaveCount(0)
    await expect(
      editor.locator(
        'td[rowspan]:not([rowspan="1"]), th[rowspan]:not([rowspan="1"])'
      )
    ).toHaveCount(0)

    await saveElement(page)

    const prisma = await getPrisma()
    const dbQuestion = await prisma.element.findFirst({
      where: { name: questionTitle, isDeleted: false },
    })
    expect(dbQuestion).not.toBeNull()
    expect(dbQuestion!.content).not.toContain('<table')
    expect(dbQuestion!.content).not.toMatch(/(?:rowspan|colspan)/i)

    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    await page.goto(`${manageUrl}/questions/${dbQuestion!.id}`)

    const previewRows = page
      .getByTestId('question-preview-container')
      .locator('table tr')
    await expectNormalizedPastedTable(previewRows)

    await page.goto(manageUrl)
    await searchAndEdit(page, questionTitle)

    const reopenedRows = page
      .getByTestId('insert-question-text')
      .locator('table tr')
    await expectNormalizedPastedTable(reopenedRows)
  })
})
