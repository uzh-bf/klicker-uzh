// pg submits a multi-statement simple query as one implicit transaction. Keep
// ordinary migrations intact (including DO blocks); split only the deliberately
// non-transactional index migrations, and reject syntax we cannot safely split.
export function migrationQueries(sql) {
  if (!/CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\b/i.test(sql)) return [sql]
  const statements = sql.replace(/--[^\n]*/g, '').trim()
  // Current concurrent-index migrations contain only identifiers and DDL.
  // Never split SQL literals, procedural bodies or explicit transactions.
  if (/['$]|\/\*|\b(?:BEGIN|COMMIT|ROLLBACK)\b/i.test(statements)) {
    throw new Error('Unsupported non-transactional migration syntax.')
  }
  const queries = statements
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
  if (
    !queries.every((query) =>
      /^(?:CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\b|ALTER\s+TABLE\b)/i.test(
        query
      )
    )
  )
    throw new Error('Unsupported non-transactional migration statement.')
  // A quoted identifier containing a semicolon would be split in the middle.
  if (queries.some((query) => (query.match(/"/g)?.length ?? 0) % 2 !== 0)) {
    throw new Error('Unsupported non-transactional migration identifier.')
  }
  return queries
}
