import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(
  new URL('./read-klicker-eval-config.mjs', import.meta.url)
)
const valid = {
  schemaVersion: 1,
  infisical: {
    domain: 'https://secrets.example.test/api',
    projectId: 'synthetic-project',
    environment: 'test',
    path: '/evaluation',
  },
  judge: { baseUrlSecret: 'JUDGE_URL', apiKeySecret: 'JUDGE_KEY' },
}

function read(config) {
  const directory = mkdtempSync(join(tmpdir(), 'eval config '))
  try {
    const path = join(directory, 'config.json')
    writeFileSync(
      path,
      typeof config === 'string' ? config : JSON.stringify(config)
    )
    return spawnSync(process.execPath, [script, path], { encoding: 'utf8' })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

test('serializes a valid scope for the launcher without shell interpretation', () => {
  const result = read(valid)
  assert.equal(result.status, 0)
  assert.deepEqual(result.stdout.trimEnd().split('\n'), [
    ...Object.values(valid.infisical),
    ...Object.values(valid.judge),
  ])
  assert.equal(result.stderr, '')
})

test('rejects malformed, incomplete and ambiguous configuration without echoing it', () => {
  const sentinel = 'synthetic-private-sentinel'
  const invalid = [
    `{${sentinel}`,
    { ...valid, schemaVersion: 2 },
    { ...valid, unexpected: sentinel },
    { ...valid, judge: { baseUrlSecret: 'JUDGE_URL' } },
    {
      ...valid,
      infisical: {
        ...valid.infisical,
        domain: `https://user:${sentinel}@example.test`,
      },
    },
    {
      ...valid,
      infisical: { ...valid.infisical, domain: 'http://example.test' },
    },
    { ...valid, infisical: { ...valid.infisical, path: 'relative' } },
    {
      ...valid,
      infisical: { ...valid.infisical, environment: `test\n${sentinel}` },
    },
    { ...valid, judge: { ...valid.judge, apiKeySecret: '--token' } },
    { ...valid, judge: { ...valid.judge, apiKeySecret: '' } },
  ]
  for (const config of invalid) {
    const result = read(config)
    assert.equal(result.status, 1)
    assert.equal(result.stdout, '')
    assert.ok(result.stderr.length > 0)
    assert.ok(!result.stderr.includes(sentinel))
  }
})
