/**
 * ZA-editor-rich-features.spec.ts
 *
 * Tests Tiptap rich text editor features: formatting shortcuts,
 * GFM tables insertion, contextual menu additions,
 * syntax highlighted code blocks, and HTML rendering in frontend previews.
 */

import { getPrisma } from '../global-setup.js'
import { cleanupTest } from '../util/cleanup.js'
import { URL_MANAGE } from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'
import {
  saveElement,
  setElementStatus,
  switchElementType,
} from '../util/fixtures/elements.js'
import { elementTypeLabels, statusLabels } from '../util/messages.js'

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
    await cellA1.click()
    await cellA1.pressSequentially('CellA1')

    // Focused in a cell: verify contextual toolbar actions (+R, +C, M/S, Del) show up
    const addRowBtn = page.getByTestId('table-add-row')
    await expect(addRowBtn).toBeVisible()

    // Click Add Row
    await addRowBtn.click()

    // Verify row count increases to 4
    await expect(tableElement.locator('tr')).toHaveCount(4)

    // 5. Test Syntax-Highlighted Code Block
    // Click outside of table area in the editor to append text (target only top-level paragraphs)
    await editor.locator('> p').last().click()

    // Create code block via input rule: typing ```js followed by space/Enter
    await page.keyboard.type('```js ')
    await page.keyboard.type('const count = 99;')

    // Verify Highlight.js token spans inside the editor
    const codeBlock = editor.locator('pre code')
    await expect(codeBlock).toBeVisible()
    await expect(codeBlock.locator('span.hljs-keyword')).toHaveText('const')
    await expect(codeBlock.locator('span.hljs-number')).toHaveText('99')

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
    await expect(previewContainer.locator('table td').first()).toContainText(
      'CellA1'
    )

    // Assert that code block renders with Prism token styling class names
    const previewCode = previewContainer.locator('pre code')
    await expect(previewCode).toBeVisible()
    await expect(previewCode.locator('span.token.keyword')).toHaveText('const')
    await expect(previewCode.locator('span.token.number')).toHaveText('99')
  })
})
