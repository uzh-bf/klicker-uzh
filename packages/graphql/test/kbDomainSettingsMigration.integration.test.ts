import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { prisma, requireDisposableDatabase } from '@klicker-uzh/prisma'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * The initialization statements in the KB subject-and-language migration are
 * hand-written, so they are the part a schema diff cannot check. This suite runs
 * the committed statements themselves against synthetic knowledge bases, inside
 * a transaction it rolls back, so the rule stays verified even though the
 * migration is frozen once it is merged.
 */
const MIGRATION = new URL(
  '../../prisma/src/prisma/schema/migrations/20260922120000_kb_domain_settings/migration.sql',
  import.meta.url
)

function initializationStatements(): string[] {
  return readFileSync(MIGRATION, 'utf8')
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => /^(--[^\n]*\n)*\s*UPDATE\b/i.test(statement))
}

class Rollback extends Error {}

type Triple = [string, number, string] | null

async function initialize(
  builds: { triple: Triple; published?: boolean }[][]
): Promise<Triple[]> {
  const statements = initializationStatements()
  expect(statements).toHaveLength(2)
  const ownerId = randomUUID()
  const kbIds = builds.map(() => randomUUID())
  const observed: Triple[] = []
  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: ownerId,
          email: `${ownerId}@example.org`,
          shortname: `kbdomain-${ownerId.slice(0, 8)}`,
        },
      })
      for (const [index, kbBuilds] of builds.entries()) {
        const kbId = kbIds[index]!
        await tx.kB.create({
          data: {
            id: kbId,
            ownerId,
            name: `Synthetic knowledge base ${index}`,
          },
        })
        for (const build of kbBuilds) {
          const buildId = randomUUID()
          await tx.kBGraphBuild.create({
            data: {
              id: buildId,
              kbId,
              graphName: `synthetic-${buildId}`,
              sourceContentDigest: 'a'.repeat(64),
              domainPolicyId: build.triple?.[0] ?? null,
              domainPolicyVersion: build.triple?.[1] ?? null,
              domainPolicyLanguage: build.triple?.[2] ?? null,
            },
          })
          if (build.published) {
            await tx.kB.update({
              where: { id: kbId },
              data: { publishedGraphBuildId: buildId },
            })
          }
        }
      }
      // The columns start empty on every existing row, which is the state the
      // migration runs against.
      await tx.kB.updateMany({
        where: { id: { in: kbIds } },
        data: {
          domainPolicyId: null,
          domainPolicyVersion: null,
          domainPolicyLanguage: null,
        },
      })
      for (const statement of statements) {
        await tx.$executeRawUnsafe(statement)
      }
      const rows = await tx.kB.findMany({
        where: { id: { in: kbIds } },
        select: {
          id: true,
          domainPolicyId: true,
          domainPolicyVersion: true,
          domainPolicyLanguage: true,
        },
      })
      for (const kbId of kbIds) {
        const row = rows.find((candidate) => candidate.id === kbId)!
        observed.push(
          row.domainPolicyId === null
            ? null
            : [
                row.domainPolicyId,
                row.domainPolicyVersion!,
                row.domainPolicyLanguage!,
              ]
        )
      }
      throw new Rollback()
    })
  } catch (error) {
    if (!(error instanceof Rollback)) throw error
  }
  return observed
}

describe('KB subject and language initialization', () => {
  beforeAll(async () => {
    await requireDisposableDatabase(prisma)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('adopts the published build even when a later build chose differently', async () => {
    const [observed] = await initialize([
      [
        { triple: ['finance', 1, 'en'], published: true },
        { triple: ['economics', 1, 'de'] },
      ],
    ])
    expect(observed).toEqual(['finance', 1, 'en'])
  })

  it('adopts the builds own choice when every build that recorded one agrees', async () => {
    const [observed] = await initialize([
      [{ triple: ['economics', 1, 'de'] }, { triple: ['economics', 1, 'de'] }],
    ])
    expect(observed).toEqual(['economics', 1, 'de'])
  })

  it('leaves a knowledge base empty when its builds disagree', async () => {
    const [observed] = await initialize([
      [{ triple: ['economics', 1, 'de'] }, { triple: ['finance', 1, 'en'] }],
    ])
    expect(observed).toBeNull()
  })

  it('leaves a knowledge base empty when no build recorded a choice', async () => {
    const [observed] = await initialize([[{ triple: null }, { triple: null }]])
    expect(observed).toBeNull()
  })

  it('does not let one knowledge base decide another', async () => {
    const observed = await initialize([
      [{ triple: ['finance', 1, 'en'] }],
      [{ triple: ['business', 1, 'de'] }],
      [],
    ])
    expect(observed).toEqual([
      ['finance', 1, 'en'],
      ['business', 1, 'de'],
      null,
    ])
  })
})
