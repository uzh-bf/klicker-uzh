import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, it } from 'node:test'
import { Pool } from 'pg'
import { getCourseDeletionAdvisoryLockKey } from '../src/coursePurge.js'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for Prisma integration tests')
}
const databaseUrl = new URL(process.env.DATABASE_URL)
databaseUrl.searchParams.delete('connection_limit')
databaseUrl.searchParams.delete('pool_timeout')
databaseUrl.searchParams.delete('schema')
const pool = new Pool({ connectionString: databaseUrl.toString(), max: 2 })

after(async () => {
  await pool.end()
})

describe('course deletion PostgreSQL fence', () => {
  it('allows concurrent response admissions while excluding deletion', async () => {
    const advisoryLockKey = getCourseDeletionAdvisoryLockKey(
      `advisory-lock-test-${randomUUID()}`
    )
    const first = await pool.connect()
    const second = await pool.connect()

    try {
      await first.query('BEGIN')
      const firstAdmission = await first.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_xact_lock_shared(hashtextextended($1, 0)) AS acquired',
        [advisoryLockKey]
      )
      assert.equal(firstAdmission.rows[0]?.acquired, true)

      await second.query('BEGIN')
      const secondAdmission = await second.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_xact_lock_shared(hashtextextended($1, 0)) AS acquired',
        [advisoryLockKey]
      )
      assert.equal(secondAdmission.rows[0]?.acquired, true)
      await second.query('ROLLBACK')

      await second.query('BEGIN')
      const blockedDeletion = await second.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS acquired',
        [advisoryLockKey]
      )
      assert.equal(blockedDeletion.rows[0]?.acquired, false)
      await second.query('ROLLBACK')

      await first.query('COMMIT')
      await second.query('BEGIN')
      const admittedDeletion = await second.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS acquired',
        [advisoryLockKey]
      )
      assert.equal(admittedDeletion.rows[0]?.acquired, true)
      await second.query('COMMIT')
    } finally {
      await first.query('ROLLBACK').catch(() => undefined)
      await second.query('ROLLBACK').catch(() => undefined)
      first.release()
      second.release()
    }
  })
})
