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
  for (const command of commands.start) {
    assert.equal(command.args.includes('ingestion_api.migrations'), false)
    assert.equal(command.executable, 'uv')
    assert.ok(command.args.includes('--no-sync'))
    assert.equal(command.env.PYTHON_DOTENV_DISABLED, '1')
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
  assert.equal(document.reason, 'provider-startup-initializes-state')
  assert.ok(document.command.args.includes('doc_processing.main:app'))
  assert.ok(document.command.args.includes('18084'))
  assert.deepEqual(document.command.env, { PYTHON_DOTENV_DISABLED: '1' })
})
