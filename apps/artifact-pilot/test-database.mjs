import assert from 'node:assert/strict'

export async function requireDisposableDatabase(
  pool,
  expectedName = 'artifact_pilot_test'
) {
  const { rows } = await pool.query(
    `
    SELECT current_database() AS name,
           shobj_description(d.oid, 'pg_database') AS marker,
           r.rolsuper OR r.rolcreatedb OR r.rolcreaterole
             OR r.rolreplication OR r.rolbypassrls AS privileged
      FROM pg_database AS d
      JOIN pg_roles AS r ON r.rolname = session_user
     WHERE d.datname = current_database()
  `
  )
  assert.equal(rows[0]?.name, expectedName)
  assert.equal(rows[0]?.marker, 'klicker-disposable-test-v1')
  assert.equal(rows[0]?.privileged, false)
}
