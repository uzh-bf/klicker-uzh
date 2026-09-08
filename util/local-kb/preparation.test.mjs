import assert from 'node:assert/strict'
import {
  chmod,
  mkdtemp,
  readFile,
  realpath,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { resolveIsolatedConfig } from './isolated-config.mjs'
import {
  claimPreparation,
  completePreparation,
  requirePreparation,
} from './preparation.mjs'

const revision = 'a'.repeat(40)
async function fixture() {
  const checkout = await realpath(
    await mkdtemp(join(tmpdir(), 'kb-preparation-'))
  )
  const providers = Object.fromEntries(
    ['ingestion', 'scraping', 'retrieval', 'docProcessing'].map((name) => [
      name,
      { path: `/synthetic/providers/${name}`, revision },
    ])
  )
  return resolveIsolatedConfig({
    primaryCheckoutPath: '/synthetic/primary',
    runtimeCheckoutPath: checkout,
    retainedCheckoutPaths: ['/synthetic/retained'],
    projectIdentity: 'isolated-preparation-test',
    retainedProjectIdentities: [],
    retainedMutableVolumeNames: [],
    retainedEndpointOrigins: [],
    providerRoots: providers,
    providerObservations: Object.fromEntries(
      Object.entries(providers).map(([name, value]) => [
        name,
        { ...value, clean: true },
      ])
    ),
    endpoints: Object.fromEntries(
      [
        'klicker',
        'postgres',
        'hatchet',
        'redis',
        'blob',
        'ingestion',
        'dispatcher',
        'callback',
        'scraping',
        'crawl4ai',
        'milvus',
        'objectBacking',
        'retrieval',
        'docProcessing',
      ].map((name, i) => [name, `http://127.0.0.1:${19000 + i}/health`])
    ),
  })
}

test('exclusive preparation retains partial failure and never implicitly retries setup', async () => {
  const config = await fixture()
  const claims = await Promise.allSettled([
    claimPreparation(config, revision),
    claimPreparation(config, revision),
  ])
  assert.equal(claims.filter(({ status }) => status === 'fulfilled').length, 1)
  await assert.rejects(requirePreparation(config, revision), { code: 'ENOENT' })
  await assert.rejects(claimPreparation(config, revision), { code: 'EEXIST' })
  await completePreparation(config, revision)
  assert.equal(
    (await requirePreparation(config, revision)).candidateRevision,
    revision
  )
  await assert.rejects(completePreparation(config, revision), {
    code: 'EEXIST',
  })
})

test('candidate or configuration changes invalidate prepared state without changing it', async () => {
  const config = await fixture()
  await claimPreparation(config, revision)
  await completePreparation(config, revision)
  const path = join(
    config.project.runtimeCheckoutPath,
    '.local-kb/prepared.json'
  )
  const before = await readFile(path, 'utf8')
  await assert.rejects(requirePreparation(config, 'b'.repeat(40)), /identity/)
  const altered = structuredClone(config)
  altered.endpoints.postgres.url = 'http://127.0.0.1:25000/health'
  await assert.rejects(requirePreparation(altered, revision), /configuration/)
  assert.equal(await readFile(path, 'utf8'), before)
})

test('preexisting state, exposed evidence and symlinked state are rejected', async () => {
  const config = await fixture()
  const directory = join(config.project.runtimeCheckoutPath, '.local-kb')
  await symlink('/synthetic/unowned', directory)
  await assert.rejects(claimPreparation(config, revision), { code: 'EEXIST' })

  const other = await fixture()
  await claimPreparation(other, revision)
  const claim = join(
    other.project.runtimeCheckoutPath,
    '.local-kb/preparation.json'
  )
  await chmod(claim, 0o644)
  await assert.rejects(completePreparation(other, revision), /owner-only/)
  await chmod(claim, 0o600)
  await writeFile(claim, '{}')
  await assert.rejects(completePreparation(other, revision), /identity/)
})
