import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import pg from 'pg'
import {
  assertDisposableDatabaseIdentity,
  assertNoPostgresEnvironmentOverrides,
  disposableDatabaseIdentityQuery,
  validateDisposableDatabaseUrl,
} from '../src/disposableDatabase.js'

// These logins exist only for this suite in an already migrated, marked test DB.
const owner = 'mcp_bearer_test_owner'
const writer = 'mcp_bearer_test_writer'
const reader = 'mcp_bearer_test_reader'
const otherWriter = 'mcp_bearer_test_other_writer'
const otherReader = 'mcp_bearer_test_other_reader'
const roles = [owner, writer, reader, otherWriter, otherReader]
const ciphertext = (byte: string) =>
  `${byte.repeat(32)}:${byte.repeat(32)}:${byte.repeat(80)}`
const endpoint = 'http://synthetic/mcp/klicker'
const config = {
  databaseName: 'klicker_test',
  endpoint,
  projectId: 'synthetic-project',
  secretEnvironment: 'stg',
  secretPath: '/',
  secretKey: 'DOC_QUERY_JWT_TOKEN_KLICKER',
}

test('database enforces bearer custody with restricted runtime roles', async (t) => {
  assertNoPostgresEnvironmentOverrides()
  const url = validateDisposableDatabaseUrl(process.env.DATABASE_URL)
  const guard = new pg.Client({ connectionString: url })
  await guard.connect()
  try {
    assertDisposableDatabaseIdentity(
      (await guard.query(disposableDatabaseIdentityQuery)).rows
    )
  } finally {
    await guard.end()
  }
  // Never accept an independent admin destination: it must be this guarded DB.
  const adminUrl = new URL(process.env.MCP_BEARER_TEST_ADMIN_URL ?? '')
  const normalUrl = new URL(url)
  assert.equal(adminUrl.host, normalUrl.host)
  assert.equal(adminUrl.pathname, '/klicker_test')
  assert.equal(adminUrl.search, '')
  assert.equal(adminUrl.hash, '')
  assert.ok(['postgres', 'klicker'].includes(adminUrl.username))
  const admin = new pg.Client({ connectionString: adminUrl.toString() })
  await admin.connect()
  const clients: pg.Client[] = []
  let provisioned = false
  const ids = [randomUUID(), randomUUID()]
  const targets = ids.map((id, i) => ({
    copy: i === 0 ? 'primary' : 'compat',
    id,
    name: `synthetic-bearer-${id}`,
    url: endpoint,
    authType: 'bearer',
    isActive: true,
  }))
  async function connect(role: string) {
    const connection = new URL(url)
    connection.username = role
    connection.password = 'synthetic-test'
    const client = new pg.Client({ connectionString: connection.toString() })
    await client.connect()
    clients.push(client)
    return client
  }
  async function call(client: pg.Client, action: string, payload = {}) {
    const result = await client.query(
      'SELECT public.mcp_bearer_rotation($1, $2::jsonb) AS state',
      [action, JSON.stringify(payload)]
    )
    return result.rows[0].state
  }
  async function reset() {
    for (const client of clients) await client.end()
    clients.length = 0
    await admin.query(
      `UPDATE public."MCPBearerRotation" SET stage = 'idle', "generationId" = NULL,
       "operationBinding" = NULL, "claimedBackendPid" = NULL, "claimedBackendStart" = NULL,
       "lastFailureClass" = NULL, "lastInspectedAt" = NULL, "lastVerifiedAt" = NULL,
       expiries = '{}'::jsonb, config = $1, targets = $2 WHERE "writerRole" = $3`,
      [JSON.stringify(config), JSON.stringify(targets), writer]
    )
    await admin.query(
      `UPDATE public."ChatbotMCPServer" SET "authSecret" = $1, "isActive" = true,
       url = $2 WHERE id = ANY($3::uuid[])`,
      [ciphertext('a'), endpoint, ids]
    )
    const client = await connect(writer)
    return { client, state: await call(client, 'open') }
  }
  async function claim(
    client: pg.Client,
    state: { config: unknown; copies: unknown[] }
  ) {
    const generation = randomUUID()
    const iat = Math.floor(Date.now() / 1000)
    await call(client, 'claim', {
      generation,
      iat,
      exp: iat + 2592000,
      config: state.config,
      snapshot: state.copies,
    })
    return generation
  }
  async function publish(
    client: pg.Client,
    state: { config: unknown; copies: unknown[] }
  ) {
    const generation = await claim(client, state)
    await call(client, 'transition', {
      generation,
      expected: 'claimed',
      next: 'publication_intent',
    })
    await call(client, 'transition', {
      generation,
      expected: 'publication_intent',
      next: 'published',
    })
    return generation
  }
  try {
    const identity = (await admin.query(disposableDatabaseIdentityQuery))
      .rows[0]
    assert.equal(identity.database, 'klicker_test')
    assert.equal(identity.marker, 'klicker-disposable-test-v1')
    assert.equal(
      (
        await admin.query(
          'SELECT count(*)::int AS n FROM public."MCPBearerRotation"'
        )
      ).rows[0].n,
      0
    )
    // A single transaction refuses any pre-existing test role without adopting it.
    await admin.query('BEGIN')
    try {
      for (const role of roles) {
        await admin.query(
          `CREATE ROLE ${role} ${role === owner ? 'NOLOGIN' : "LOGIN PASSWORD 'synthetic-test'"} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`
        )
      }
      await admin.query(
        `ALTER TABLE public."MCPBearerRotation" OWNER TO ${owner}`
      )
      await admin.query(
        `ALTER FUNCTION public.mcp_bearer_rotation(text, jsonb) OWNER TO ${owner}`
      )
      await admin.query(`GRANT USAGE ON SCHEMA public TO ${roles.join(',')}`)
      await admin.query(
        `GRANT SELECT, UPDATE ON public."ChatbotMCPServer" TO ${owner}`
      )
      await admin.query(
        `GRANT EXECUTE ON FUNCTION public.mcp_bearer_rotation(text, jsonb) TO ${writer}, ${otherWriter}`
      )
      await admin.query(
        `GRANT SELECT (environment, tenant, stage, expiries, "lastInspectedAt", "lastVerifiedAt", "lastFailureClass") ON public."MCPBearerRotation" TO ${reader}, ${otherReader}`
      )
      for (const target of targets) {
        await admin.query(
          `INSERT INTO public."ChatbotMCPServer" (id, name, url, "authType", "authSecret", "updatedAt") VALUES ($1, $2, $3, 'bearer', $4, now())`,
          [target.id, target.name, endpoint, ciphertext('a')]
        )
      }
      for (const [environment, w, r] of [
        ['stg', writer, reader],
        ['prd', otherWriter, otherReader],
      ]) {
        await admin.query(
          `INSERT INTO public."MCPBearerRotation" (environment, tenant, "writerRole", "readerRole", config, targets) VALUES ($1, 'klicker', $2, $3, $4, $5)`,
          [
            environment,
            w,
            r,
            JSON.stringify({ ...config, secretEnvironment: environment }),
            JSON.stringify(targets),
          ]
        )
      }
      await admin.query('COMMIT')
      provisioned = true
    } catch (error) {
      await admin.query('ROLLBACK')
      throw error
    }

    await t.test(
      'runtime roles cannot read secrets, edit configuration or cross environments',
      async () => {
        const { client } = await reset()
        const metrics = await connect(reader)
        const other = await connect(otherWriter)
        assert.equal((await call(other, 'open')).environment, 'prd')
        for (const sql of [
          'SELECT * FROM public."ChatbotMCPServer"',
          'SELECT * FROM public."MCPBearerRotation"',
          `UPDATE public."MCPBearerRotation" SET config = '{}'::jsonb`,
        ])
          await assert.rejects(client.query(sql), { code: '42501' })
        await assert.rejects(
          metrics.query('SELECT config FROM public."MCPBearerRotation"'),
          { code: '42501' }
        )
        await assert.rejects(call(metrics, 'open'), { code: '42501' })
        assert.deepEqual(
          (
            await metrics.query(
              'SELECT environment FROM public."MCPBearerRotation"'
            )
          ).rows,
          [{ environment: 'stg' }]
        )
        await assert.rejects(call(client, 'open', { environment: 'prd' }), {
          code: 'P0001',
        })
        await assert.rejects(call(client, 'arbitrary_sql'), { code: 'P0001' })
      }
    )

    await t.test(
      'session lock excludes a second writer and is required by every action',
      async () => {
        const { client } = await reset()
        const second = await connect(writer)
        assert.deepEqual(await call(second, 'open'), { busy: true })
        await assert.rejects(call(second, 'failure'), { code: 'P0001' })
        await client.query('SELECT pg_advisory_unlock_all()')
        await assert.rejects(
          call(client, 'inspect', {
            expiries: { source: 1, primary: 1, compat: 1 },
          }),
          { code: 'P0001' }
        )
        assert.equal((await call(second, 'open')).stage, 'idle')
      }
    )

    await t.test(
      'claim rejects stale configuration, invalid TTL and a substituted snapshot',
      async () => {
        const { client, state } = await reset()
        const iat = Math.floor(Date.now() / 1000)
        const payload = {
          generation: randomUUID(),
          iat,
          exp: iat + 2592000,
          config,
          snapshot: state.copies,
        }
        for (const invalid of [
          { ...payload, exp: iat + 1 },
          { ...payload, iat: null },
          { ...payload, config: { ...config, projectId: 'substituted' } },
          { ...payload, snapshot: [] },
          { ...payload, targets: targets },
        ])
          await assert.rejects(call(client, 'claim', invalid), {
            code: 'P0001',
          })
        assert.equal((await call(client, 'snapshot')).stage, 'idle')
      }
    )

    await t.test(
      'publication and two-copy update commit together; verification records success',
      async () => {
        const { client, state } = await reset()
        const generation = await publish(client, state)
        await call(client, 'apply', {
          generation,
          snapshot: state.copies,
          ciphertexts: [ciphertext('b'), ciphertext('c')],
        })
        const current = await call(client, 'snapshot')
        assert.equal(current.stage, 'database_applied')
        assert.deepEqual(
          current.copies.map((row: { authSecret: string }) => row.authSecret),
          [ciphertext('b'), ciphertext('c')]
        )
        await call(client, 'inspect', {
          expiries: {
            source: 2000000000,
            primary: 2000000000,
            compat: 2000000000,
          },
        })
        await call(client, 'transition', {
          generation,
          expected: 'database_applied',
          next: 'verified',
        })
        const metrics = await connect(reader)
        const result = (
          await metrics.query(
            'SELECT stage, "lastInspectedAt", "lastVerifiedAt" FROM public."MCPBearerRotation"'
          )
        ).rows[0]
        assert.equal(result.stage, 'verified')
        assert.ok(result.lastInspectedAt && result.lastVerifiedAt)
      }
    )

    for (const alteration of [
      'ciphertext',
      'metadata',
      'allowlist',
      'second_update',
    ]) {
      await t.test(
        `apply rolls back both copies on ${alteration} conflict`,
        async () => {
          const { client, state } = await reset()
          const generation = await publish(client, state)
          if (alteration === 'ciphertext')
            await admin.query(
              'UPDATE public."ChatbotMCPServer" SET "authSecret" = $1 WHERE id = $2',
              [ciphertext('d'), ids[1]]
            )
          if (alteration === 'metadata')
            await admin.query(
              'UPDATE public."ChatbotMCPServer" SET "isActive" = false WHERE id = $1',
              [ids[1]]
            )
          if (alteration === 'allowlist')
            await admin.query(
              'UPDATE public."MCPBearerRotation" SET config = jsonb_set(config, \'{projectId}\', \'"changed"\') WHERE "writerRole" = $1',
              [writer]
            )
          if (alteration === 'second_update') {
            await admin.query(
              `CREATE FUNCTION public.mcp_bearer_test_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id = '${ids[1]}'::uuid THEN RETURN NULL; END IF; RETURN NEW; END $$`
            )
            await admin.query(
              'CREATE TRIGGER mcp_bearer_test_reject BEFORE UPDATE ON public."ChatbotMCPServer" FOR EACH ROW EXECUTE FUNCTION public.mcp_bearer_test_reject()'
            )
          }
          try {
            await assert.rejects(
              call(client, 'apply', {
                generation,
                snapshot: state.copies,
                ciphertexts: [ciphertext('b'), ciphertext('c')],
              }),
              { code: 'P0001' }
            )
            const copies = (
              await admin.query(
                'SELECT "authSecret" FROM public."ChatbotMCPServer" WHERE id = ANY($1::uuid[]) ORDER BY id',
                [ids]
              )
            ).rows
            assert.ok(
              copies.every(
                (row) =>
                  row.authSecret === ciphertext('a') ||
                  (alteration === 'ciphertext' &&
                    row.authSecret === ciphertext('d'))
              )
            )
            assert.equal(
              (
                await admin.query(
                  'SELECT stage FROM public."MCPBearerRotation" WHERE "writerRole" = $1',
                  [writer]
                )
              ).rows[0].stage,
              'published'
            )
          } finally {
            if (alteration === 'second_update') {
              await admin.query(
                'DROP TRIGGER mcp_bearer_test_reject ON public."ChatbotMCPServer"'
              )
              await admin.query('DROP FUNCTION public.mcp_bearer_test_reject()')
            }
          }
        }
      )
    }

    for (const stage of [
      'claimed',
      'publication_intent',
      'published',
      'database_applied',
    ]) {
      await t.test(
        `a killed ${stage} session cannot be resumed by its successor`,
        async () => {
          const { client, state } = await reset()
          const generation = await claim(client, state)
          if (stage !== 'claimed')
            await call(client, 'transition', {
              generation,
              expected: 'claimed',
              next: 'publication_intent',
            })
          if (['published', 'database_applied'].includes(stage))
            await call(client, 'transition', {
              generation,
              expected: 'publication_intent',
              next: 'published',
            })
          if (stage === 'database_applied')
            await call(client, 'apply', {
              generation,
              snapshot: state.copies,
              ciphertexts: [ciphertext('b'), ciphertext('c')],
            })
          const pid = (await client.query('SELECT pg_backend_pid() AS pid'))
            .rows[0].pid
          const terminated = new Promise<void>((resolve) =>
            client.on('error', () => resolve())
          )
          await admin.query('SELECT pg_terminate_backend($1)', [pid])
          await terminated
          const successor = await connect(writer)
          assert.equal((await call(successor, 'open')).stage, stage)
          await assert.rejects(claim(successor, state), { code: 'P0001' })
          await assert.rejects(
            call(successor, 'transition', {
              generation,
              expected: stage,
              next: stage === 'database_applied' ? 'verified' : 'published',
            }),
            { code: 'P0001' }
          )
          await assert.rejects(
            call(successor, 'apply', {
              generation,
              snapshot: state.copies,
              ciphertexts: [ciphertext('d'), ciphertext('d')],
            }),
            { code: 'P0001' }
          )
          assert.equal((await call(successor, 'snapshot')).stage, stage)
        }
      )
    }

    await t.test(
      'failure preserves inspection age; invalid metadata and latch clearing are rejected',
      async () => {
        const { client } = await reset()
        await call(client, 'inspect', {
          expiries: { source: 1, primary: 2, compat: 3 },
        })
        const before = (
          await admin.query(
            'SELECT "lastInspectedAt" FROM public."MCPBearerRotation" WHERE "writerRole" = $1',
            [writer]
          )
        ).rows[0].lastInspectedAt
        await call(client, 'failure')
        await call(client, 'conflict')
        for (const expiries of [
          { source: 1 },
          { source: 1, primary: 2, compat: '3' },
          { source: 1, primary: 2, compat: null },
        ])
          await assert.rejects(call(client, 'inspect', { expiries }), {
            code: 'P0001',
          })
        await assert.rejects(
          call(client, 'transition', {
            generation: randomUUID(),
            expected: 'needs_reconciliation',
            next: 'idle',
          }),
          { code: 'P0001' }
        )
        const after = (
          await admin.query(
            'SELECT "lastInspectedAt", stage FROM public."MCPBearerRotation" WHERE "writerRole" = $1',
            [writer]
          )
        ).rows[0]
        assert.deepEqual(after.lastInspectedAt, before)
        assert.equal(after.stage, 'needs_reconciliation')
      }
    )
  } finally {
    for (const client of clients) await client.end()
    if (provisioned) {
      await admin.query(
        'DELETE FROM public."MCPBearerRotation" WHERE "writerRole" = ANY($1::text[])',
        [[writer, otherWriter]]
      )
      await admin.query(
        'DELETE FROM public."ChatbotMCPServer" WHERE id = ANY($1::uuid[])',
        [ids]
      )
      await admin.query(
        'ALTER TABLE public."MCPBearerRotation" OWNER TO klicker_test'
      )
      await admin.query(
        'ALTER FUNCTION public.mcp_bearer_rotation(text, jsonb) OWNER TO klicker_test'
      )
      await admin.query(
        `REVOKE ALL ON FUNCTION public.mcp_bearer_rotation(text, jsonb) FROM ${writer}, ${otherWriter}`
      )
      await admin.query(
        `REVOKE SELECT (environment, tenant, stage, expiries, "lastInspectedAt", "lastVerifiedAt", "lastFailureClass") ON public."MCPBearerRotation" FROM ${reader}, ${otherReader}`
      )
      await admin.query(`REVOKE ALL ON public."ChatbotMCPServer" FROM ${owner}`)
      await admin.query(`REVOKE ALL ON SCHEMA public FROM ${roles.join(',')}`)
      for (const role of roles) await admin.query(`DROP ROLE ${role}`)
    }
    await admin.end()
  }
})
