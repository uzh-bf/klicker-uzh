import assert from 'node:assert/strict'
import test from 'node:test'
import { migrationQueries } from '../src/scripts/migrationQueries.mjs'

test('preserves ordinary SQL including procedural semicolons', () => {
  const sql = 'DO $$ BEGIN PERFORM 1; END $$; SELECT 1;'
  assert.deepEqual(migrationQueries(sql), [sql])
})
test('executes concurrent indexes outside implicit multi-statement transactions', () => {
  const sql = `-- deliberately non-transactional
ALTER TABLE "Example" ADD COLUMN "submissionId" UUID;
CREATE UNIQUE INDEX CONCURRENTLY "submission_key" ON "Example"("submissionId");
CREATE INDEX CONCURRENTLY "other_key" ON "Example"("id");`
  const queries = migrationQueries(sql)
  assert.equal(queries.length, 3)
  assert.match(queries[0], /^ALTER TABLE/)
  assert.match(queries[1], /^CREATE UNIQUE INDEX CONCURRENTLY/)
  assert.match(queries[2], /^CREATE INDEX CONCURRENTLY/)
})
test('rejects unsupported syntax rather than naively splitting it', () => {
  for (const sql of [
    'BEGIN; CREATE INDEX CONCURRENTLY "ix" ON "t"("id"); COMMIT;',
    'CREATE INDEX CONCURRENTLY "semi;colon" ON "t"("id");',
    'CREATE INDEX CONCURRENTLY ix ON t ((\u0027a;b\u0027));',
    'CREATE INDEX CONCURRENTLY ix ON t(id); DO $$ BEGIN END $$;',
    '/* comment */ CREATE INDEX CONCURRENTLY ix ON t(id);',
  ])
    assert.throws(() => migrationQueries(sql), /Unsupported/)
})
