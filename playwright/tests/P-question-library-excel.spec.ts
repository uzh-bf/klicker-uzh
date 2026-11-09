import { writeFile } from 'node:fs/promises'
import type { Page, TestInfo } from '@playwright/test'
import { getPrisma } from '../global-setup.js'
import { LECTURER_ID } from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'
import {
  createAnswerCollection,
  createQuestionSC,
  createQuestionSE,
} from '../util/fixtures/elements.js'

// Uploads, imports and exports go through blob storage. `v3` has no local
// blob storage, so these cases run only where it is configured (the `v3-ai`
// devcontainer with Azurite, or real storage credentials).
const hasBlobStorage = process.env.PLAYWRIGHT_BLOB_STORAGE === 'true'
const BLOB_STORAGE_REASON =
  'needs blob storage; set PLAYWRIGHT_BLOB_STORAGE=true where it is configured'

const TEMPLATE_EXAMPLES = [
  'Example: Single choice',
  'Example: Multiple choice',
  'Example: Kprim',
  'Example: Numerical',
  'Example: Free text',
  'Example: Content',
  'Example: Flashcard',
]

/** Imported elements carry an `excel-v6:` origin; the examples share one tag. */
async function deleteImportedElements() {
  const prisma = await getPrisma()
  await prisma.element.deleteMany({
    where: { ownerId: LECTURER_ID, originalId: { startsWith: 'excel-v6:' } },
  })
  await prisma.tag.deleteMany({
    where: { ownerId: LECTURER_ID, name: 'Examples' },
  })
}

async function searchElements(page: Page, term: string) {
  const search = page.getByTestId('elements-search-input')
  await search.fill(term)
  await search.press('Enter')
}

async function openImport(page: Page) {
  await page.getByTestId('import-elements-excel').click()
  await expect(page.getByTestId('element-workbook-import')).toBeVisible()
}

async function downloadTemplate(page: Page, testInfo: TestInfo) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('element-workbook-download-template').click(),
  ])
  expect(download.suggestedFilename()).toBe('klickeruzh-element-template.xlsx')
  const path = testInfo.outputPath('template.xlsx')
  await download.saveAs(path)
  return path
}

async function checkWorkbook(page: Page, path: string) {
  await page.getByTestId('element-workbook-file').setInputFiles(path)
  await page.getByTestId('element-workbook-check').click()
}

test('offers Excel import and export in the element library', async ({
  page,
  loginLecturer,
}, testInfo) => {
  const elementName = `XLS Entry ${testInfo.workerIndex}-${testInfo.retry}`
  await createQuestionSC({
    name: elementName,
    content: 'Synthetic Excel entry point content.',
    choices: [
      { value: 'Correct', correct: true },
      { value: 'Incorrect', correct: false },
    ],
    userId: LECTURER_ID,
  })

  try {
    await loginLecturer()

    await expect(page.getByTestId('import-elements-excel')).toBeVisible()
    await expect(page.getByTestId('export-elements-excel')).toBeHidden()

    // The template is generated server-side and needs no blob storage.
    await openImport(page)
    const template = await downloadTemplate(page, testInfo)
    expect(template).toBeTruthy()

    // Anything but .xlsx is rejected before upload.
    const notWorkbook = testInfo.outputPath('notes.txt')
    await writeFile(notWorkbook, 'not a workbook')
    await page.getByTestId('element-workbook-file').setInputFiles(notWorkbook)
    await expect(page.getByText('Choose an Excel file (.xlsx).')).toBeVisible()
    await expect(page.getByTestId('element-workbook-check')).toBeDisabled()
    await page.getByTestId('close-element-workbook-import').click()

    await searchElements(page, elementName)
    await page.getByTestId(`element-checkbox-${elementName}`).check()
    await expect(page.getByTestId('export-elements-excel')).toHaveText(
      'Export to Excel (1)'
    )
    await page.getByTestId('export-elements-excel').click()
    await expect(page.getByTestId('element-workbook-summary')).toHaveText(
      '1 of 1 selected elements will be exported'
    )
    await expect(page.getByTestId('element-workbook-unsupported')).toBeHidden()
    await expect(
      page.getByTestId('element-workbook-include-tags')
    ).toBeChecked()
  } finally {
    const prisma = await getPrisma()
    await prisma.element.deleteMany({ where: { name: elementName } })
  }
})

test('imports the template, skips duplicates and reports invalid files', async ({
  page,
  loginLecturer,
}, testInfo) => {
  test.skip(!hasBlobStorage, BLOB_STORAGE_REASON)
  await deleteImportedElements()

  try {
    await loginLecturer()
    await openImport(page)
    const template = await downloadTemplate(page, testInfo)

    await checkWorkbook(page, template)
    const preview = page.getByTestId('element-workbook-preview')
    await expect(preview.getByText('Will be created')).toHaveCount(
      TEMPLATE_EXAMPLES.length
    )
    for (const name of TEMPLATE_EXAMPLES) {
      await expect(preview.getByText(name, { exact: true })).toBeVisible()
    }
    await expect(
      page.getByTestId('element-workbook-import-confirm')
    ).toHaveText(`Import ${TEMPLATE_EXAMPLES.length} elements`)
    await page.getByTestId('element-workbook-import-confirm').click()

    await expect(
      page.getByText(`${TEMPLATE_EXAMPLES.length} elements imported`)
    ).toBeVisible()
    await page.getByTestId('element-workbook-done').click()
    await searchElements(page, 'Example:')
    for (const name of TEMPLATE_EXAMPLES) {
      await expect(page.getByTestId(`element-item-${name}`)).toBeVisible()
    }

    // The same file again: every row is already in the library.
    await openImport(page)
    await checkWorkbook(page, template)
    await expect(
      preview.getByText(/^Already in your library: Example: /)
    ).toHaveCount(TEMPLATE_EXAMPLES.length)
    await expect(
      page.getByText('Every element in this file is already in your library.')
    ).toBeVisible()
    await expect(
      page.getByTestId('element-workbook-import-confirm')
    ).toBeDisabled()

    // A file that is not a workbook fails validation with a typed message.
    await page.getByRole('button', { name: 'Back' }).click()
    const corrupt = testInfo.outputPath('corrupt.xlsx')
    await writeFile(corrupt, 'this is not a zip archive')
    await checkWorkbook(page, corrupt)
    await expect(page.getByTestId('element-workbook-error')).toContainText(
      "This file isn't a valid Excel workbook."
    )
  } finally {
    await deleteImportedElements()
  }
})

test('exports selected elements and re-imports them as duplicates', async ({
  page,
  loginLecturer,
}, testInfo) => {
  test.skip(!hasBlobStorage, BLOB_STORAGE_REASON)
  const prefix = `XLS Export ${testInfo.workerIndex}-${testInfo.retry}`
  const scName = `${prefix} single choice`
  const seName = `${prefix} selection`
  const collectionName = `${prefix} collection`
  await createQuestionSC({
    name: scName,
    content: 'Synthetic Excel export content.',
    choices: [
      { value: 'Correct', correct: true },
      { value: 'Incorrect', correct: false },
    ],
    userId: LECTURER_ID,
  })
  await createAnswerCollection({
    name: collectionName,
    description: 'Synthetic answer collection.',
    entries: ['Alpha', 'Beta'],
    userId: LECTURER_ID,
  })
  await createQuestionSE({
    name: seName,
    content: 'Synthetic selection content.',
    collectionName,
    numberOfInputs: 1,
    userId: LECTURER_ID,
  })

  try {
    await loginLecturer()
    await searchElements(page, prefix)
    await page.getByTestId(`element-checkbox-${scName}`).check()
    await page.getByTestId(`element-checkbox-${seName}`).check()
    await page.getByTestId('export-elements-excel').click()

    await expect(page.getByTestId('element-workbook-summary')).toHaveText(
      '1 of 2 selected elements will be exported'
    )
    await expect(
      page.getByTestId('element-workbook-unsupported')
    ).toContainText(seName)

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('element-workbook-export-confirm').click(),
    ])
    expect(download.suggestedFilename()).toMatch(
      /^klickeruzh-elements-\d{4}-\d{2}-\d{2}\.xlsx$/
    )
    const exported = testInfo.outputPath('export.xlsx')
    await download.saveAs(exported)
    await expect(page.getByText('1 element exported.')).toBeVisible()
    await page.getByTestId('element-workbook-export-done').click()

    // The exported row is the same teaching content as the source element.
    await openImport(page)
    await checkWorkbook(page, exported)
    await expect(
      page
        .getByTestId('element-workbook-preview')
        .getByText(`Already in your library: ${scName}`)
    ).toBeVisible()
    await expect(
      page.getByTestId('element-workbook-import-confirm')
    ).toBeDisabled()
  } finally {
    const prisma = await getPrisma()
    await prisma.element.deleteMany({ where: { name: { startsWith: prefix } } })
    await prisma.answerCollection.deleteMany({
      where: { name: collectionName },
    })
  }
})
