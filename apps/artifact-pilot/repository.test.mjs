import assert from 'node:assert/strict'
import test from 'node:test'
import { Pool } from 'pg'
import { baseExercise, sourceFor } from './exercise.mjs'
import {
  bindAssignment,
  initialize,
  publish,
  readAssignment,
  readRevision,
} from './repository.mjs'

test('retries, concurrent saves and later publications preserve the original assignment', async () => {
  // This suite requires its own empty disposable database.
  const pool = new Pool({
    connectionString: process.env.ARTIFACT_TEST_DATABASE_URL,
  })
  try {
    const info = await pool.query(
      "SELECT current_database() AS name, to_regclass('artifact') AS previous"
    )
    assert.equal(info.rows[0].name, 'artifact_pilot_test')
    assert.equal(info.rows[0].previous, null)
    await initialize(pool)
    const html = sourceFor(baseExercise)
    const [first, retry] = await Promise.all(
      [1, 2].map(() => publish(pool, 'lecturer', 'bond', html))
    )
    assert.equal(first.revisionId, retry.revisionId)
    const later = await publish(
      pool,
      'lecturer',
      'bond',
      sourceFor({ ...baseExercise, title: 'Revision two' })
    )
    assert.equal(first.artifactId, later.artifactId)
    assert.notEqual(first.revisionId, later.revisionId)
    assert.equal(
      (await readRevision(pool, 'lecturer', first.artifactId)).version,
      2
    )
    assert.equal(
      (await readRevision(pool, 'lecturer', first.artifactId, first.revisionId))
        .html,
      html
    )
    assert.equal(
      await readRevision(pool, 'outsider', first.artifactId),
      undefined
    )
    const pin = {
      courseId: 'course',
      instanceId: 'instance',
      artifactId: first.artifactId,
      revisionId: first.revisionId,
    }
    assert.equal(await bindAssignment(pool, 'outsider', pin), false)
    assert.equal(await bindAssignment(pool, 'lecturer', pin), true)
    assert.equal(await bindAssignment(pool, 'lecturer', pin), true)
    assert.equal(
      await bindAssignment(pool, 'lecturer', {
        ...pin,
        revisionId: later.revisionId,
      }),
      false
    )
    assert.equal(
      (
        await readAssignment(
          pool,
          'course',
          'instance',
          first.artifactId,
          first.revisionId
        )
      ).digest,
      first.digest
    )
    assert.equal(
      await readAssignment(
        pool,
        'other-course',
        'instance',
        first.artifactId,
        first.revisionId
      ),
      undefined
    )
    for (let i = 2; i < 49; i++) {
      await publish(
        pool,
        'lecturer',
        'bond',
        sourceFor({ ...baseExercise, title: 'Trial ' + i })
      )
    }
    const last = await Promise.allSettled(
      ['A', 'B'].map((title) =>
        publish(pool, 'lecturer', 'bond', sourceFor({ ...baseExercise, title }))
      )
    )
    assert.equal(last.filter((r) => r.status === 'fulfilled').length, 1)
    assert.equal(last.find((r) => r.status === 'rejected').reason.status, 409)
    assert.equal(
      (await publish(pool, 'lecturer', 'bond', html)).revisionId,
      first.revisionId
    )
  } finally {
    await pool.end()
  }
})
