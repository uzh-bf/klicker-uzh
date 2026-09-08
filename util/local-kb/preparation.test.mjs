import assert from 'node:assert/strict'
import { createPrivateKey, createPublicKey } from 'node:crypto'
import {
  chmod,
  mkdtemp,
  readFile,
  realpath,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { docProcessingImageRevision } from './doc-processing-compose.mjs'
import { ingestionImageRevision } from './ingestion-compose.mjs'
import { resolveIsolatedConfig } from './isolated-config.mjs'
import {
  claimPreparation,
  completePreparation,
  deliverHatchetToken,
  initializeProviderStorage,
  prepareLocalConfiguration,
  requirePreparation,
} from './preparation.mjs'
import { retrievalImageRevision } from './retrieval-compose.mjs'
import { scrapingImageRevision } from './scraping-compose.mjs'

const revision = 'a'.repeat(40)
const unusedProject = () => ({ unused: true, context: 'synthetic-local' })
async function fixture() {
  const checkout = await realpath(
    await mkdtemp(join(tmpdir(), 'kb-preparation-'))
  )
  const providers = Object.fromEntries(
    ['ingestion', 'scraping', 'retrieval', 'docProcessing'].map((name) => [
      name,
      {
        path: `/synthetic/providers/${name}`,
        revision: {
          ingestion: ingestionImageRevision,
          scraping: scrapingImageRevision,
          retrieval: retrievalImageRevision,
          docProcessing: docProcessingImageRevision,
        }[name],
      },
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

test('Hatchet token delivery is private, one-shot and rejects injectable output', async () => {
  const config = await fixture()
  await claimPreparation(config, revision)
  await assert.rejects(
    deliverHatchetToken(config, revision, 'invalid\nINJECTED=value'),
    /valid token shape/
  )
  const token = 'synthetic.header.signature'
  assert.deepEqual(await deliverHatchetToken(config, revision, `${token}\n`), {
    delivered: true,
  })
  const path = join(
    config.project.runtimeCheckoutPath,
    '.local-kb/hatchet-client.env'
  )
  assert.equal((await stat(path)).mode & 0o777, 0o600)
  const original = await readFile(path, 'utf8')
  assert.ok(original.includes(`HATCHET_CLIENT_TOKEN=${token}\n`))
  await assert.rejects(
    deliverHatchetToken(config, revision, 'another.token.value'),
    {
      code: 'EEXIST',
    }
  )
  assert.equal(await readFile(path, 'utf8'), original)
})

test('storage setup runs migrations once and does not qualify the full runtime', async () => {
  const config = await fixture()
  await claimPreparation(config, revision)
  await prepareLocalConfiguration(config, revision)
  const calls = []
  const run = async (args) => {
    calls.push(args)
    return args.includes('exec') ? 'synthetic.header.signature' : ''
  }
  assert.deepEqual(
    await initializeProviderStorage(config, revision, run, unusedProject),
    {
      storageInitialized: true,
    }
  )
  assert.deepEqual(
    calls.map((args) => args.at(-1)),
    [
      'postgres',
      'hatchet-setup',
      'ingestion-setup',
      'doc-processing-setup',
      'hatchet',
      '/config/authdisabled-token',
    ]
  )
  await assert.rejects(requirePreparation(config, revision), { code: 'ENOENT' })
  await assert.rejects(
    initializeProviderStorage(config, revision, run, unusedProject),
    {
      code: 'EEXIST',
    }
  )
  assert.equal(calls.length, 6)
  assert.equal(
    (
      await stat(
        join(config.project.runtimeCheckoutPath, '.local-kb/hatchet-client.env')
      )
    ).mode & 0o777,
    0o600
  )
})

test('storage setup stops on failure, suppresses provider output and refuses replay', async () => {
  const config = await fixture()
  await claimPreparation(config, revision)
  await prepareLocalConfiguration(config, revision)
  let calls = 0
  const run = async () => {
    calls += 1
    if (calls === 2) throw new Error('synthetic-sensitive-provider-output')
  }
  await assert.rejects(
    initializeProviderStorage(config, revision, run, unusedProject),
    (error) => {
      assert.equal(
        error.message.includes('synthetic-sensitive-provider-output'),
        false
      )
      return true
    }
  )
  await assert.rejects(
    initializeProviderStorage(config, revision, run, unusedProject),
    {
      code: 'EEXIST',
    }
  )
  assert.equal(calls, 2)
})

test('storage collision prevents every setup command', async () => {
  const config = await fixture()
  await claimPreparation(config, revision)
  await prepareLocalConfiguration(config, revision)
  await assert.rejects(
    initializeProviderStorage(
      config,
      revision,
      async () => assert.fail('must not mutate Docker'),
      (compose) => {
        assert.ok(compose.volumes.milvus)
        assert.ok(compose.volumes['document-processing'])
        return { unused: false, reason: 'existing-project-or-storage' }
      }
    ),
    /not confirmed unused/
  )
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

test('configuration setup writes private local material once without completing preparation', async () => {
  const config = await fixture()
  await claimPreparation(config, revision)
  assert.deepEqual(await prepareLocalConfiguration(config, revision), {
    configured: true,
  })
  const directory = join(config.project.runtimeCheckoutPath, '.local-kb')
  const environment = join(directory, 'ingestion.env')
  const bootstrapPath = join(directory, 'bootstrap.compose.json')
  const bootstrap = JSON.parse(await readFile(bootstrapPath, 'utf8'))
  assert.equal(bootstrap.name, config.project.identity)
  assert.equal((await stat(bootstrapPath)).mode & 0o777, 0o600)
  assert.ok(bootstrap.services['hatchet-setup'])
  assert.equal(bootstrap.services['ingestion-api'], undefined)
  const providers = JSON.parse(
    await readFile(join(directory, 'providers.compose.json'), 'utf8')
  )
  assert.ok(providers.services['ingestion-api'])
  assert.ok(providers.services['doc-query'])
  assert.ok(providers.volumes.milvus)
  // Hatchet publishes this file in the separate storage-initialization phase.
  await deliverHatchetToken(config, revision, 'synthetic.header.signature')
  for (const service of Object.values(providers.services)) {
    for (const entry of service.env_file ?? []) {
      assert.equal((await stat(entry.path)).isFile(), true)
      assert.equal((await stat(entry.path)).mode & 0o777, 0o600)
    }
  }
  const before = await readFile(environment, 'utf8')
  assert.equal((await stat(environment)).mode & 0o777, 0o600)
  assert.equal((await stat(directory)).mode & 0o777, 0o700)
  assert.equal(
    (await stat(join(directory, 'producer-registry'))).mode & 0o777,
    0o755
  )
  assert.equal(
    (await stat(join(directory, 'producer-registry/klicker.yaml'))).mode &
      0o777,
    0o644
  )
  assert.equal(
    (await stat(join(directory, 'postgres-init/01-databases.sql'))).mode &
      0o777,
    0o644
  )
  await assert.rejects(prepareLocalConfiguration(config, revision), {
    code: 'EEXIST',
  })
  assert.equal(await readFile(environment, 'utf8'), before)
  await assert.rejects(requirePreparation(config, revision), { code: 'ENOENT' })
  const registry = JSON.parse(
    await readFile(join(directory, 'producer-registry/klicker.yaml'), 'utf8')
  )
  assert.equal(
    registry.auth.credential_secret_ref,
    'ingestion-producer-klicker'
  )
  const projectPath = join(
    directory,
    'project-configs',
    `${registry.producer.allowed_projects[0]}.yaml`
  )
  const project = JSON.parse(await readFile(projectPath, 'utf8'))
  assert.equal(project.project_name, registry.producer.allowed_projects[0])
  assert.equal(project.artifacts.enabled, true)
  assert.equal((await stat(projectPath)).mode & 0o777, 0o644)
  const chatPath = join(directory, 'chat.env')
  assert.equal((await stat(chatPath)).mode & 0o777, 0o600)
  const chat = Object.fromEntries(
    (await readFile(chatPath, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => {
        const separator = line.indexOf('=')
        return [line.slice(0, separator), line.slice(separator + 1)]
      })
  )
  const reader = JSON.parse(
    await readFile(
      join(directory, 'doc-query-tools/knowledge-bases.yaml'),
      'utf8'
    )
  )
  const verification = reader.token_scope.verification
  assert.equal(verification.issuer, chat.DOC_QUERY_SCOPE_ISSUER)
  assert.equal(verification.audience, chat.DOC_QUERY_SCOPE_AUDIENCE)
  assert.equal(verification.keys[0].kid, chat.DOC_QUERY_SCOPE_KID)
  const publicKey = createPublicKey(
    createPrivateKey(chat.DOC_QUERY_SCOPE_PRIVATE_KEY.replaceAll('\\n', '\n'))
  )
  assert.equal(
    publicKey.export({ type: 'spki', format: 'pem' }),
    verification.keys[0].pem
  )
})
