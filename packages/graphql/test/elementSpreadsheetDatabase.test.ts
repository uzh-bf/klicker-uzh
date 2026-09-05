import type { ContextWithUser } from '../src/lib/context.js'
import { elementSpreadsheetTablesFromElements } from '../src/lib/elementSpreadsheetExport.js'
import { emptyElementSpreadsheetTables } from '../src/lib/elementSpreadsheetTables.js'
import { writeKlickerWorkbook } from '../src/lib/elementSpreadsheetWorkbook.js'
import { importElementPackageBuffer } from '../src/services/elementImportPackage.js'
import { parseElementImportPackage } from '../src/services/elementImportPackageParser.js'
import {
  importElementSpreadsheet,
  validateElementSpreadsheet,
} from '../src/services/elementSpreadsheet.js'
import {
  clearPackageRateLimitKeys,
  uploadPreparedImportPackage,
  useImportExportTestEnvironment,
  withEnv,
} from './elementImportExportTestSupport.js'
import { createNineTypeImportPackage } from './fixtures/importExportNineTypes.js'
import { initializePrisma, testCleanup, testInitialization } from './helpers.js'

describe('spreadsheet import transactions', () => {
  useImportExportTestEnvironment()
  let initialized: Awaited<ReturnType<typeof initializePrisma>>
  let ctx: ContextWithUser
  let otherCtx: ContextWithUser
  beforeAll(async () => {
    initialized = await initializePrisma()
    await testCleanup(initialized.prisma)
  })
  beforeEach(async () => {
    const contexts = await testInitialization(
      initialized.prisma,
      initialized.hatchet,
      initialized.emitter
    )
    ctx = contexts.userOneCtx
    otherCtx = contexts.userTwoCtx
    await clearPackageRateLimitKeys(ctx)
  })
  afterEach(async () => {
    await testCleanup(initialized.prisma)
  })
  afterAll(async () => {
    await initialized.prisma.$disconnect()
  })

  async function prepare(
    name = 'Question',
    repeat = false,
    content = 'Same authored content',
    owner = ctx
  ) {
    const tables = emptyElementSpreadsheetTables()
    tables.Elements.push({
      sheet: 'Elements',
      row: 2,
      values: {
        ref: 'first',
        type: 'CONTENT',
        name,
        content,
        basePoints: true,
        pointsMultiplier: 1,
      },
    })
    if (repeat)
      tables.Elements.push({
        sheet: 'Elements',
        row: 3,
        values: {
          ...tables.Elements[0]!.values,
          ref: 'second',
          name: 'Different title',
        },
      })
    const artifact = await uploadPreparedImportPackage(
      await writeKlickerWorkbook(tables),
      owner
    )
    const preview = await validateElementSpreadsheet(
      { artifactId: artifact.artifactId },
      owner
    )
    expect(preview.importToken).toBeTruthy()
    return {
      importToken: preview.importToken!,
      selectedElementRefs: preview.elements.map((element) => element.ref),
    }
  }

  it('skips repeated rows and replays the identical report after imported elements are deleted', async () => {
    const selection = await prepare('Question', true)
    const first = await importElementSpreadsheet(selection, ctx)
    expect(first).toEqual({
      importedElements: 1,
      skippedElementRefs: ['second'],
    })
    await ctx.prisma.element.deleteMany({ where: { ownerId: ctx.user.sub } })
    expect(await importElementSpreadsheet(selection, ctx)).toEqual(first)
  })

  it('allows an all-duplicate result and retains its report', async () => {
    expect(
      (await importElementSpreadsheet(await prepare(), ctx)).importedElements
    ).toBe(1)
    const selection = await prepare('Renamed question')
    const result = await importElementSpreadsheet(selection, ctx)
    expect(result).toEqual({
      importedElements: 0,
      skippedElementRefs: ['first'],
    })
    expect(await importElementSpreadsheet(selection, ctx)).toEqual(result)
  })

  it('serializes two concurrent imports of the same content', async () => {
    const first = await prepare('First title')
    const second = await prepare('Second title')
    const results = await withEnv(
      { IMPORT_EXPORT_PACKAGE_IMPORT_CONCURRENCY: '2' },
      () =>
        Promise.all([
          importElementSpreadsheet(first, ctx),
          importElementSpreadsheet(second, ctx),
        ])
    )
    expect(results.map((result) => result.importedElements).sort()).toEqual([
      0, 1,
    ])
    expect(
      await ctx.prisma.element.count({ where: { ownerId: ctx.user.sub } })
    ).toBe(1)
  })

  it('imports changed content instead of treating its title as identity', async () => {
    await importElementSpreadsheet(await prepare(), ctx)
    const result = await importElementSpreadsheet(
      await prepare('Question', false, 'Different content'),
      ctx
    )
    expect(result).toEqual({ importedElements: 1, skippedElementRefs: [] })
  })

  it('compares against existing ZIP-imported content for all nine types', async () => {
    const fixture = createNineTypeImportPackage()
    const source = parseElementImportPackage(fixture.buffer)
    await importElementPackageBuffer(
      { buffer: fixture.buffer, selectedElementRefs: fixture.elementRefs },
      ctx
    )
    const artifact = await uploadPreparedImportPackage(
      await writeKlickerWorkbook(
        elementSpreadsheetTablesFromElements(
          source.elements,
          source.answerCollections
        )
      ),
      ctx
    )
    const preview = await validateElementSpreadsheet(
      { artifactId: artifact.artifactId },
      ctx
    )
    const result = await importElementSpreadsheet(
      {
        importToken: preview.importToken!,
        selectedElementRefs: preview.elements.map((element) => element.ref),
      },
      ctx
    )
    expect(result.importedElements).toBe(0)
    expect(result.skippedElementRefs).toHaveLength(9)
  })

  it('keeps duplicate matching scoped to the importing owner', async () => {
    await importElementSpreadsheet(await prepare(), ctx)
    const result = await importElementSpreadsheet(
      await prepare('Title', false, 'Same authored content', otherCtx),
      otherCtx
    )
    expect(result).toEqual({ importedElements: 1, skippedElementRefs: [] })
  })
})
