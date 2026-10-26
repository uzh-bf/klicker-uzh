import type {
  AccessTokenRecord,
  DatabaseManager,
  IdTokenClaims,
  IdTokenRecord,
  PlatformAttributes,
  PlatformFilter,
  PlatformRecord,
} from 'ltijs'
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from 'node:crypto'
import pg from 'pg'

// Lifetimes of the short-lived records, matching ltijs's MongoDB adapter.
const ACCESS_TOKEN_TTL = '1 hour'
const NONCE_TTL = '10 minutes'
const ID_TOKEN_TTL = '24 hours'

// The ltijs 7 tables use their own names, so the tables ltijs-sequelize
// created for ltijs 5 are left untouched.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS ltijs_platform (
  id text PRIMARY KEY,
  url text NOT NULL,
  client_id text NOT NULL,
  attributes jsonb NOT NULL,
  private_key text NOT NULL,
  UNIQUE (url, client_id)
);
CREATE TABLE IF NOT EXISTS ltijs_access_token (
  platform_url text NOT NULL,
  client_id text NOT NULL,
  scopes text NOT NULL,
  token jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (platform_url, client_id, scopes)
);
CREATE TABLE IF NOT EXISTS ltijs_id_token (
  id text PRIMARY KEY,
  claims jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ltijs_id_token_created_at ON ltijs_id_token (created_at);
CREATE TABLE IF NOT EXISTS ltijs_nonce (
  nonce text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
`

type PlatformRow = {
  id: string
  attributes: Omit<PlatformAttributes, 'keys'> & { publicKey: string }
  private_key: string
}

// Stores ltijs 7 state in PostgreSQL. Platform private keys sign the launch
// state and ltik, so they are encrypted at rest with LTI_ENCRYPTION_KEY.
export class PostgresDatabaseManager implements DatabaseManager {
  private readonly pool: pg.Pool
  private readonly key: Buffer

  constructor(config: pg.PoolConfig, encryptionKey: string) {
    this.pool = new pg.Pool(config)
    this.key = createHash('sha256').update(encryptionKey).digest()
  }

  async listen() {
    await this.pool.query(SCHEMA)
  }

  async close() {
    await this.pool.end()
  }

  async getPlatforms(filter: PlatformFilter = {}) {
    const conditions: string[] = []
    const values: unknown[] = []
    if (filter.url !== undefined) {
      values.push(filter.url)
      conditions.push(`url = $${values.length}`)
    }
    if (filter.name !== undefined) {
      values.push(filter.name)
      conditions.push(`attributes->>'name' = $${values.length}`)
    }
    if (filter.clientId !== undefined) {
      values.push(
        Array.isArray(filter.clientId) ? filter.clientId : [filter.clientId]
      )
      conditions.push(`client_id = ANY($${values.length})`)
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const { rows } = await this.pool.query<PlatformRow>(
      `SELECT id, attributes, private_key FROM ltijs_platform ${where}`,
      values
    )
    return rows.map((row) => this.toPlatformRecord(row))
  }

  async getPlatformById(id: string) {
    const { rows } = await this.pool.query<PlatformRow>(
      'SELECT id, attributes, private_key FROM ltijs_platform WHERE id = $1',
      [id]
    )
    return rows[0] && this.toPlatformRecord(rows[0])
  }

  async getPlatformByUrlAndClientId(url: string, clientId: string) {
    const { rows } = await this.pool.query<PlatformRow>(
      'SELECT id, attributes, private_key FROM ltijs_platform WHERE url = $1 AND client_id = $2',
      [url, clientId]
    )
    return rows[0] && this.toPlatformRecord(rows[0])
  }

  // Replicas register the same platforms at startup, so a concurrent insert
  // keeps the first stored record and its keys.
  async savePlatform(platform: PlatformAttributes) {
    const { keys, ...attributes } = platform
    const { rows } = await this.pool.query<{ id: string }>(
      `INSERT INTO ltijs_platform (id, url, client_id, attributes, private_key)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (url, client_id) DO UPDATE SET url = EXCLUDED.url
       RETURNING id`,
      [
        randomUUID(),
        platform.url,
        platform.clientId,
        { ...attributes, publicKey: keys.public },
        this.encrypt(keys.private),
      ]
    )
    return rows[0]!.id
  }

  async updatePlatformById(id: string, fields: Partial<PlatformAttributes>) {
    const current = await this.getPlatformById(id)
    if (!current) return
    const { id: _id, keys, ...attributes } = { ...current, ...fields }
    await this.pool.query(
      `UPDATE ltijs_platform
       SET url = $2, client_id = $3, attributes = $4, private_key = $5
       WHERE id = $1`,
      [
        id,
        attributes.url,
        attributes.clientId,
        { ...attributes, publicKey: keys.public },
        this.encrypt(keys.private),
      ]
    )
  }

  async deletePlatformById(id: string) {
    await this.pool.query('DELETE FROM ltijs_platform WHERE id = $1', [id])
  }

  async getAccessToken(platformUrl: string, clientId: string, scopes: string) {
    const { rows } = await this.pool.query<{
      token: Omit<AccessTokenRecord, 'createdAt'>
      created_at: Date
    }>(
      `SELECT token, created_at FROM ltijs_access_token
       WHERE platform_url = $1 AND client_id = $2 AND scopes = $3
         AND created_at > now() - interval '${ACCESS_TOKEN_TTL}'`,
      [platformUrl, clientId, scopes]
    )
    const row = rows[0]
    return row && { ...row.token, createdAt: row.created_at.getTime() }
  }

  async saveAccessToken(
    platformUrl: string,
    clientId: string,
    scopes: string,
    token: AccessTokenRecord
  ) {
    const { createdAt: _createdAt, ...value } = token
    await this.pool.query(
      `INSERT INTO ltijs_access_token (platform_url, client_id, scopes, token)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (platform_url, client_id, scopes)
       DO UPDATE SET token = EXCLUDED.token, created_at = now()`,
      [platformUrl, clientId, scopes, value]
    )
    return `${platformUrl} ${clientId} ${scopes}`
  }

  async getIdToken(id: string) {
    const { rows } = await this.pool.query<{ claims: IdTokenClaims }>(
      `SELECT claims FROM ltijs_id_token
       WHERE id = $1 AND created_at > now() - interval '${ID_TOKEN_TTL}'`,
      [id]
    )
    return rows[0] && ({ ...rows[0].claims, id } as IdTokenRecord)
  }

  async saveIdToken(token: IdTokenClaims) {
    const id = randomUUID()
    await this.pool.query(
      `DELETE FROM ltijs_id_token WHERE created_at < now() - interval '${ID_TOKEN_TTL}'`
    )
    await this.pool.query(
      'INSERT INTO ltijs_id_token (id, claims) VALUES ($1, $2)',
      [id, token]
    )
    return id
  }

  // Removes a launch's id_token so its ltik cannot start another session.
  // Returns false when the record was already consumed or has expired.
  async consumeIdToken(id: string) {
    const { rowCount } = await this.pool.query(
      `DELETE FROM ltijs_id_token
       WHERE id = $1 AND created_at > now() - interval '${ID_TOKEN_TTL}'`,
      [id]
    )
    return rowCount === 1
  }

  async saveNonce(nonce: string) {
    await this.pool.query(
      `DELETE FROM ltijs_nonce WHERE created_at < now() - interval '${NONCE_TTL}'`
    )
    await this.pool.query(
      'INSERT INTO ltijs_nonce (nonce) VALUES ($1) ON CONFLICT DO NOTHING',
      [nonce]
    )
    return nonce
  }

  async consumeNonce(nonce: string) {
    const { rowCount } = await this.pool.query(
      `DELETE FROM ltijs_nonce
       WHERE nonce = $1 AND created_at > now() - interval '${NONCE_TTL}'`,
      [nonce]
    )
    return rowCount === 1
  }

  private toPlatformRecord(row: PlatformRow): PlatformRecord {
    const { publicKey, ...attributes } = row.attributes
    return {
      ...attributes,
      id: row.id,
      keys: { public: publicKey, private: this.decrypt(row.private_key) },
    }
  }

  private encrypt(value: string) {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)
    const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
    return [iv, cipher.getAuthTag(), data]
      .map((part) => part.toString('base64'))
      .join('.')
  }

  private decrypt(value: string) {
    const [iv, tag, data] = value
      .split('.')
      .map((part) => Buffer.from(part, 'base64'))
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv!)
    decipher.setAuthTag(tag!)
    return Buffer.concat([decipher.update(data!), decipher.final()]).toString(
      'utf8'
    )
  }
}
