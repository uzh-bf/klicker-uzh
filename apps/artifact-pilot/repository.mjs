import { randomUUID } from 'node:crypto'
import { digest, parseSource } from './exercise.mjs'

export async function initialize(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS artifact (
      id uuid PRIMARY KEY, owner text NOT NULL, source_id text NOT NULL,
      UNIQUE(owner, source_id)
    );
    CREATE TABLE IF NOT EXISTS artifact_revision (
      id uuid PRIMARY KEY, artifact_id uuid NOT NULL REFERENCES artifact(id),
      version integer NOT NULL CHECK (version > 0),
      digest text NOT NULL, html text NOT NULL CHECK (octet_length(html) <= 65536),
      UNIQUE (artifact_id, version), UNIQUE (artifact_id, digest), UNIQUE (artifact_id, id)
    );
    CREATE TABLE IF NOT EXISTS artifact_assignment (
      course_id text NOT NULL, instance_id text NOT NULL,
      artifact_id uuid NOT NULL, revision_id uuid NOT NULL,
      PRIMARY KEY(course_id, instance_id),
      FOREIGN KEY (artifact_id,revision_id) REFERENCES artifact_revision(artifact_id,id)
    )
  `)
}

const projection =
  'r.id AS "revisionId", r.artifact_id AS "artifactId", r.version, r.digest, r.html'
export async function readRevision(
  client,
  owner,
  artifactId,
  revisionId = null
) {
  const result = await client.query(
    `
    SELECT ${projection} FROM artifact_revision AS r JOIN artifact AS a ON a.id = r.artifact_id
    WHERE a.owner = $1 AND a.id = $2 AND ($3::uuid IS NULL OR r.id = $3)
    ORDER BY r.version DESC LIMIT 1
  `,
    [owner, artifactId, revisionId]
  )
  return result.rows[0]
}

export async function publish(pool, owner, sourceId, html) {
  parseSource(html)
  const hash = digest(html)
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    // Serialize admission so concurrent publishers cannot exceed the global revision limit.
    await db.query('LOCK TABLE artifact_revision IN SHARE ROW EXCLUSIVE MODE')
    const {
      rows: [artifact],
    } = await db.query(
      `
      INSERT INTO artifact (id, owner, source_id) VALUES ($1,$2,$3)
      ON CONFLICT (owner, source_id) DO UPDATE SET source_id = EXCLUDED.source_id RETURNING id
    `,
      [randomUUID(), owner, sourceId]
    )
    const {
      rows: [existing],
    } = await db.query(
      'SELECT id FROM artifact_revision WHERE artifact_id=$1 AND digest=$2',
      [artifact.id, hash]
    )
    let id = existing?.id
    if (!id) {
      const {
        rows: [usage],
      } = await db.query(
        'SELECT count(*)::integer AS used FROM artifact_revision'
      )
      if (usage.used >= 50)
        throw Object.assign(new Error('Revision allowance reached'), {
          status: 409,
        })
      id = randomUUID()
      await db.query(
        `INSERT INTO artifact_revision (id,artifact_id,version,digest,html)
        SELECT $1,$2,COALESCE(MAX(version),0)+1,$3,$4 FROM artifact_revision WHERE artifact_id=$2`,
        [id, artifact.id, hash, html]
      )
    }
    const revision = await readRevision(db, owner, artifact.id, id)
    await db.query('COMMIT')
    return revision
  } catch (error) {
    await db.query('ROLLBACK')
    throw error
  } finally {
    db.release()
  }
}

export async function bindAssignment(
  pool,
  owner,
  { courseId, instanceId, artifactId, revisionId }
) {
  const revision = await readRevision(pool, owner, artifactId, revisionId)
  if (!revision) return false
  // An instance is immutable. Replaying the same binding is safe after a timeout.
  const result = await pool.query(
    `
    INSERT INTO artifact_assignment AS a (course_id,instance_id,artifact_id,revision_id)
    VALUES ($1,$2,$3,$4) ON CONFLICT (course_id,instance_id) DO UPDATE
    SET revision_id = EXCLUDED.revision_id
    WHERE a.artifact_id = EXCLUDED.artifact_id AND a.revision_id = EXCLUDED.revision_id
    RETURNING revision_id`,
    [courseId, instanceId, artifactId, revisionId]
  )
  return result.rowCount === 1
}

export async function readAssignment(
  pool,
  courseId,
  instanceId,
  artifactId,
  revisionId
) {
  const { rows } = await pool.query(
    `
    SELECT ${projection} FROM artifact_assignment AS a
    JOIN artifact_revision AS r ON a.artifact_id=r.artifact_id AND a.revision_id=r.id
    WHERE a.course_id=$1 AND a.instance_id=$2 AND a.artifact_id=$3 AND a.revision_id=$4
  `,
    [courseId, instanceId, artifactId, revisionId]
  )
  return rows[0]
}
