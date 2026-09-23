#!/usr/bin/env tsx
import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { ElementImportError } from './elementWorkbook/errors.js'
import {
  ElementWorkbookParseError,
  MAX_ELEMENT_WORKBOOK_BYTES,
  parseElementWorkbook,
} from './elementWorkbook/parse.js'
import { comparisonCsv, digest } from './elementWorkbook/plan.js'

const help = `Import fixed Klicker Excel v6 MC/Flashcards (no media fetching).
  pnpm exec tsx src/scripts/importElementWorkbook.ts --file /absolute/input.xlsx --validate-only
  pnpm exec tsx src/scripts/importElementWorkbook.ts --file /absolute/input.xlsx --owner <UUID> --state-dir /private/run

Default: validate, query the owner library, and save a dry-run preview.
Review comparison.csv and before-dump.json; repeat the same command with
DRY_RUN=false to write. Existing state must match the preview. A completed
after-dump.json prevents reuse. DATABASE_URL is supplied through the environment.
Only use sanitized teaching content; never commit input or run artifacts.`

async function exists(path: string) {
  try {
    await readFile(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: 'string' },
      owner: { type: 'string' },
      'state-dir': { type: 'string' },
      'validate-only': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
    strict: true,
  })
  if (values.help) return console.log(help)
  if (!values.file) throw new ElementImportError('--file is required')
  if ((await stat(resolve(values.file))).size > MAX_ELEMENT_WORKBOOK_BYTES)
    throw new ElementImportError('Workbook exceeds the 5 MiB limit')
  const bytes = await readFile(resolve(values.file))
  const elements = await parseElementWorkbook(bytes)
  console.log(
    `Validated ${elements.length} elements: ${elements.filter((e) => e.type === 'MC').length} MC, ${elements.filter((e) => e.type === 'FLASHCARD').length} flashcards.`
  )
  if (values['validate-only']) return
  if (
    !values.owner ||
    !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
      values.owner
    )
  )
    throw new ElementImportError('--owner must be a UUID')
  const ownerId = values.owner.toLowerCase()
  if (!values['state-dir'])
    throw new ElementImportError('--state-dir is required')
  if (!process.env.DATABASE_URL)
    throw new ElementImportError('DATABASE_URL is required')
  const target = new URL(process.env.DATABASE_URL)
  const schema = target.searchParams.get('schema') ?? 'public'
  if (schema !== 'public')
    throw new ElementImportError('Only the public database schema is supported')
  if (Object.keys(process.env).some((key) => key.startsWith('PG')))
    throw new ElementImportError(
      'Remove PostgreSQL PG* environment overrides; use DATABASE_URL only'
    )
  const binding = {
    format: 'klicker-elements-6-operator-v1',
    ownerId,
    workbookHash: createHash('sha256').update(bytes).digest('hex'),
    targetHash: digest({
      host: target.hostname,
      port: target.port,
      database: target.pathname,
      schema,
    }),
  }
  const dir = resolve(values['state-dir'])
  await mkdir(dir, { recursive: true, mode: 0o700 })
  const beforeFile = resolve(dir, 'before-dump.json')
  const afterFile = resolve(dir, 'after-dump.json')
  const lock = resolve(dir, '.running')
  await mkdir(lock, { mode: 0o700 })
  try {
    if (await exists(afterFile))
      throw new ElementImportError(
        'This run is completed; after-dump.json already exists'
      )
    // Offline validation/help never initializes Prisma or reads database state.
    const { PrismaClient } = await import('@klicker-uzh/prisma/client')
    const { PrismaPg } = await import('@prisma/adapter-pg')
    const prisma = new PrismaClient({
      adapter: new PrismaPg(
        { connectionString: process.env.DATABASE_URL },
        { schema }
      ),
      log: [],
    })
    const { executeImport, previewImport } = await import(
      './elementWorkbook/database.js'
    )
    try {
      const current = {
        binding,
        preview: await previewImport(prisma, ownerId, elements),
      }
      if (await exists(beforeFile)) {
        const saved = JSON.parse(await readFile(beforeFile, 'utf8'))
        if (digest(saved) !== digest(current))
          throw new ElementImportError(
            'Workbook, target, or database state changed; preserve this run and choose a new state directory for a new dry run'
          )
      } else {
        if (process.env.DRY_RUN === 'false')
          throw new ElementImportError(
            'Run a dry run first; no saved before-dump.json exists'
          )
        await writeFile(beforeFile, JSON.stringify(current, null, 2), {
          flag: 'wx',
          mode: 0o600,
        })
      }
      const comparison = resolve(dir, 'comparison.csv')
      if (
        (await exists(comparison)) &&
        (await readFile(comparison, 'utf8')) !==
          comparisonCsv(current.preview.decisions)
      )
        throw new ElementImportError(
          'Comparison CSV changed; preserve this run and use a new state directory'
        )
      if (!(await exists(comparison)))
        await writeFile(comparison, comparisonCsv(current.preview.decisions), {
          flag: 'wx',
          mode: 0o600,
        })
      const createCount = current.preview.decisions.filter(
        (d) => d.action === 'CREATE'
      ).length
      console.log(
        `Preview: ${createCount} new; ${elements.length - createCount} duplicates skipped. Details: ${comparison}`
      )
      if (process.env.DRY_RUN !== 'false') {
        console.log('Dry run only. No database writes performed.')
        return
      }
      const result = await executeImport(
        prisma,
        ownerId,
        elements,
        current.preview,
        digest(binding)
      )
      try {
        await writeFile(
          afterFile,
          JSON.stringify({ binding, ...result }, null, 2),
          { flag: 'wx', mode: 0o600 }
        )
      } catch {
        throw new ElementImportError(
          'Database committed, but receipt could not be saved. Do not rerun writes; reconcile the excel-v6 originalId values and saved before dump.'
        )
      }
      console.log(
        `Verification Summary: ${result.verified} Successes, 0 Mismatches; ${result.skipped.length} duplicates skipped. Receipt: ${afterFile}`
      )
    } finally {
      await prisma.$disconnect()
    }
  } finally {
    await rm(lock, { recursive: true })
  }
}

main().catch((error: unknown) => {
  // Do not print Prisma/connection error objects, query parameters, or source data.
  const safe =
    error instanceof ElementImportError ||
    error instanceof ElementWorkbookParseError
  console.error(
    safe
      ? error.message
      : 'Import failed. Check arguments, file access, database connectivity, and state-directory lock. No automatic retry was attempted; preserve the state directory before investigating.'
  )
  process.exitCode = 1
})
