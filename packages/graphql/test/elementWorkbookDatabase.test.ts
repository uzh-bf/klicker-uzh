import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import ExcelJS from 'exceljs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  executeImport,
  previewImport,
} from '../src/scripts/elementWorkbook/database.js'
import {
  ELEMENT_WORKBOOK_HEADERS,
  ELEMENT_WORKBOOK_VERSION,
  type WorkbookElement,
} from '../src/scripts/elementWorkbook/parse.js'

// Opt in only with the repository's marked, non-privileged disposable database.
describe.skipIf(process.env.RUN_ELEMENT_WORKBOOK_DB_TESTS !== 'true')(
  'element workbook persistence',
  () => {
    let prisma: PrismaClient
    let dir: string
    const owners: string[] = []
    const card: WorkbookElement = {
      sheet: 'Flashcards',
      row: 8,
      name: 'Synthetic card',
      content: 'Front [Bildplatzhalter: front.png]',
      explanation: 'Back [Bildplatzhalter: back.png]',
      type: 'FLASHCARD',
      basePoints: false,
      pointsMultiplier: 1,
      options: {},
      tags: ['Existing topic', 'New topic'],
    }
    async function owner() {
      const id = randomUUID()
      await prisma.user.create({
        data: {
          id,
          email: `${id}@example.invalid`,
          shortname: id,
          role: 'USER',
        },
      })
      owners.push(id)
      return id
    }
    beforeAll(async () => {
      const { createDisposableTestPrismaClient } = await import(
        '@klicker-uzh/prisma'
      )
      prisma = await createDisposableTestPrismaClient(process.env.DATABASE_URL!)
      dir = await mkdtemp(join(tmpdir(), 'element-workbook-test-'))
    })
    afterAll(async () => {
      if (prisma) {
        await prisma.user.deleteMany({ where: { id: { in: owners } } })
        await prisma.$disconnect()
      }
      if (dir) await rm(dir, { recursive: true, force: true })
    })

    it('previews without writes, creates private REVIEW elements, reuses tags and skips duplicates', async () => {
      const id = await owner()
      const tag = await prisma.tag.create({
        data: { ownerId: id, name: 'Existing topic' },
      })
      const elements = [card, { ...card, row: 9, name: 'Duplicate' }]
      const preview = await previewImport(prisma, id, elements)
      expect(await prisma.element.count({ where: { ownerId: id } })).toBe(0)
      expect(preview.decisions.map((d) => d.action)).toEqual([
        'CREATE',
        'SKIP_WORKBOOK',
      ])
      const result = await executeImport(
        prisma,
        id,
        elements,
        preview,
        'synthetic'
      )
      expect(result.verified).toBe(1)
      const saved = await prisma.element.findUniqueOrThrow({
        where: { id: result.created[0]!.id },
        include: { tags: true, permissions: true, directPermissions: true },
      })
      expect(saved).toMatchObject({
        content: card.content,
        explanation: card.explanation,
        status: 'REVIEW',
        ownerId: id,
        basePoints: false,
        options: {},
      })
      expect(saved.tags.map((t) => t.name).sort()).toEqual([
        'Existing topic',
        'New topic',
      ])
      expect(saved.tags.find((t) => t.name === tag.name)?.id).toBe(tag.id)
      expect(saved.permissions).toHaveLength(1)
      expect(saved.permissions[0]).toMatchObject({
        userId: id,
        permissionLevel: 'OWNER',
        derived: false,
      })
      expect(saved.directPermissions).toEqual([])
      const repeated = await previewImport(prisma, id, elements)
      expect(
        repeated.decisions.every((d) => d.action === 'SKIP_EXISTING')
      ).toBe(true)
      expect(
        (await executeImport(prisma, id, elements, repeated, 'repeat')).created
      ).toEqual([])
      expect(
        (await previewImport(prisma, await owner(), [card])).decisions[0]
          ?.action
      ).toBe('CREATE')
    })

    it('refuses stale previews and rolls back tags/elements after a failed row', async () => {
      const id = await owner()
      const preview = await previewImport(prisma, id, [card])
      await prisma.tag.create({ data: { ownerId: id, name: 'Concurrent tag' } })
      await expect(
        executeImport(prisma, id, [card], preview, 'stale')
      ).rejects.toThrow('Database changed')
      const invalid = {
        ...card,
        row: 9,
        content: 'Second row',
        pointsMultiplier: 2 ** 31,
      }
      const elements = [card, invalid]
      const fresh = await previewImport(prisma, id, elements)
      await expect(
        executeImport(prisma, id, elements, fresh, 'rollback')
      ).rejects.toThrow()
      expect(await prisma.element.count({ where: { ownerId: id } })).toBe(0)
      expect(await prisma.tag.count({ where: { ownerId: id } })).toBe(1)
    })

    it('requires a dry run, completes the CLI, and refuses a completed run', async () => {
      const id = await owner()
      const workbook = new ExcelJS.Workbook()
      workbook.addWorksheet('Instructions').getCell('A1').value =
        ELEMENT_WORKBOOK_VERSION
      for (const [name, headers] of Object.entries(ELEMENT_WORKBOOK_HEADERS)) {
        const sheet = workbook.addWorksheet(name)
        sheet.getRow(6).values = [...headers]
      }
      workbook.getWorksheet('Flashcards')!.getRow(8).values = [
        'Card',
        'Front',
        'Back',
        'Tag;"A; B"',
      ]
      const mc = workbook.getWorksheet('Multiple choice')!
      mc.getRow(8).values = ['MC', 'Question', 'Yes', 'A', 'Yes', 'B', 'No']
      mc.getCell('X8').value = 'Group explanation'
      mc.getCell('AB8').value = 'Yes'
      mc.getCell('AC8').value = 'Reason A'
      mc.getCell('AD8').value = '-'
      const file = join(dir, 'input.xlsx')
      const state = join(dir, 'run')
      await workbook.xlsx.writeFile(file)
      const run = (dryRun: string, extraEnv: Record<string, string> = {}) =>
        promisify(execFile)(
          process.execPath,
          [
            '--import',
            'tsx',
            resolve('src/scripts/importElementWorkbook.ts'),
            '--file',
            file,
            '--owner',
            id.toUpperCase(),
            '--state-dir',
            state,
          ],
          { env: { ...process.env, DRY_RUN: dryRun, ...extraEnv } }
        )
      const unsupportedSchema = new URL(process.env.DATABASE_URL!)
      unsupportedSchema.searchParams.set('schema', 'other')
      await expect(
        run('true', {
          DATABASE_URL: unsupportedSchema.toString(),
        })
      ).rejects.toMatchObject({
        stderr: expect.stringContaining('Only the public database schema'),
      })
      await expect(run('false')).rejects.toMatchObject({
        stderr: expect.stringContaining('Run a dry run first'),
      })
      expect((await run('true')).stdout).toContain('Dry run only')
      expect(await prisma.element.count({ where: { ownerId: id } })).toBe(0)
      const csvFile = join(state, 'comparison.csv')
      const csv = await readFile(csvFile, 'utf8')
      await writeFile(csvFile, `${csv}\nchanged`)
      await expect(run('false')).rejects.toMatchObject({
        stderr: expect.stringContaining('Comparison CSV changed'),
      })
      await writeFile(csvFile, csv)
      const originalBytes = await readFile(file)
      workbook.getWorksheet('Flashcards')!.getCell('B8').value = 'Changed front'
      await workbook.xlsx.writeFile(file)
      await expect(run('false')).rejects.toMatchObject({
        stderr: expect.stringContaining(
          'Workbook, target, or database state changed'
        ),
      })
      await writeFile(file, originalBytes)
      expect(await prisma.element.count({ where: { ownerId: id } })).toBe(0)
      expect((await run('false')).stdout).toContain('2 Successes, 0 Mismatches')
      const receipt = JSON.parse(
        await readFile(join(state, 'after-dump.json'), 'utf8')
      )
      expect(receipt.created).toHaveLength(2)
      const saved = await prisma.element.findFirstOrThrow({
        where: { ownerId: id, type: 'MC' },
      })
      expect(saved.explanation).toBe('Group explanation')
      expect(saved.options).toMatchObject({
        choices: [
          { ix: 0, value: 'A', correct: true, feedback: 'Reason A' },
          { ix: 1, value: 'B', correct: false, feedback: '-' },
        ],
      })
      await expect(run('false')).rejects.toMatchObject({
        stderr: expect.stringContaining('completed'),
      })
      expect(await prisma.element.count({ where: { ownerId: id } })).toBe(2)
    })
  }
)
