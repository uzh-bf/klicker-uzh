import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveLocalKbConfig } from '../local-kb-stack.mjs'
import { providerCommands } from './provider-commands.mjs'

test('separates migrations from startup and preserves argv boundaries', () => {
  const root = '/synthetic/provider with spaces'
  const commands = providerCommands(
    resolveLocalKbConfig({
      DATA_INGESTION_REPO: root,
      WEB_SCRAPING_REPO: '/synthetic/scraping',
      DOC_QUERY_REPO: '/synthetic/retrieval',
      DOC_PROCESSING_REPO: '/synthetic/doc-processing',
    })
  )
  assert.ok(commands.setup.migrations.args.includes('ingestion_api.migrations'))
  const allCommands = [
    ...commands.start,
    ...Object.values(commands.setup),
    ...commands.blockedProviders.map(({ command }) => command),
  ]
  for (const command of allCommands) {
    assert.equal(command.executable, 'uv')
    assert.ok(command.args.includes('--frozen'))
    assert.ok(command.args.includes('--no-sync'))
    assert.equal(command.env.PYTHON_DOTENV_DISABLED, '1')
  }
  for (const command of commands.start) {
    assert.equal(command.args.includes('ingestion_api.migrations'), false)
  }
  const api = commands.start.find(({ name }) => name === 'ingestion-api')
  assert.ok(api.args.includes(`${root}/modules/ingestion-api`))
  assert.equal(api.env.INGESTION_STATE_ENSURE_SCHEMA, 'false')
  const scraping = commands.start.find(({ name }) => name === 'scraping')
  assert.equal(scraping.env.WEB_SCRAPING_CACHE_SWEEP_INTERVAL_SECONDS, '0')
  assert.equal(
    commands.start.some(({ name }) => name === 'docProcessing'),
    false
  )
  const document = commands.blockedProviders.find(
    ({ name }) => name === 'docProcessing'
  )
  assert.deepEqual(
    commands.blockedProviders.map(({ name }) => name),
    [
      'docProcessing',
      'docProcessing-hatchet-worker',
      'docProcessing-callback-worker',
    ]
  )
  for (const provider of commands.blockedProviders) {
    assert.equal(provider.reason, 'isolated-storage-preparation-unverified')
    assert.ok(provider.requires.includes('isolated-prepared-storage'))
    assert.deepEqual(provider.command.env, {
      PYTHON_DOTENV_DISABLED: '1',
      DOC_PROCESSING_AUTO_INITIALIZE: '0',
    })
  }
  assert.deepEqual(document.command.args, [
    'run',
    '--frozen',
    '--no-sync',
    'uvicorn',
    'doc_processing.main:app',
    '--host',
    '127.0.0.1',
    '--port',
    '18084',
    '--workers',
    '1',
  ])
  assert.deepEqual(commands.blockedProviders[1].command.args, [
    'run',
    '--frozen',
    '--no-sync',
    'doc-processing-hatchet-worker',
  ])
  assert.deepEqual(commands.blockedProviders[2].command.args, [
    'run',
    '--frozen',
    '--no-sync',
    'doc-processing-callback-worker',
  ])
  assert.deepEqual(commands.setup.docProcessing.args, [
    'run',
    '--frozen',
    '--no-sync',
    'python',
    '-m',
    'doc_processing.setup',
  ])
  assert.deepEqual(commands.setup.docProcessing.env, {
    PYTHON_DOTENV_DISABLED: '1',
    DOC_PROCESSING_AUTO_INITIALIZE: '0',
  })
  assert.equal(
    commands.start.some((command) =>
      command.args.includes('doc_processing.setup')
    ),
    false
  )
})
