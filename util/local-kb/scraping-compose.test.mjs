import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveIsolatedConfig } from './isolated-config.mjs'
import {
  renderScrapingCompose,
  scrapingImageRevision,
} from './scraping-compose.mjs'

const providerRevisions = {
  ingestion: 'd'.repeat(40),
  scraping: scrapingImageRevision,
  retrieval: '8'.repeat(40),
  docProcessing: 'c'.repeat(40),
}

function makeInput(name, scrapingRevision = providerRevisions.scraping) {
  const projectIdentity = `isolated-scraping-${name}`
  const primaryCheckoutPath = `/synthetic/checkouts/${name}/primary`
  const runtimeCheckoutPath = `/synthetic/checkouts/${name}/runtime`
  const providerBase = `/synthetic/providers/${name}`
  const providerRoots = Object.fromEntries(
    Object.entries({ ...providerRevisions, scraping: scrapingRevision }).map(
      ([providerName, revision]) => [
        providerName,
        {
          path: `${providerBase}/${providerName}`,
          revision,
        },
      ]
    )
  )
  const providerObservations = Object.fromEntries(
    Object.entries(providerRoots).map(([providerName, root]) => [
      providerName,
      { path: root.path, revision: root.revision, clean: true },
    ])
  )

  return {
    primaryCheckoutPath,
    runtimeCheckoutPath,
    retainedCheckoutPaths: [`/synthetic/checkouts/${name}/retained`],
    projectIdentity,
    retainedProjectIdentities: [`retained-scraping-${name}`],
    retainedMutableVolumeNames: [`retained-scraping-${name}-postgres-volume`],
    retainedEndpointOrigins: ['https://retained.example.invalid:443'],
    providerRoots,
    providerObservations,
    endpoints: {
      klicker: `http://127.0.0.1:${18000 + name.charCodeAt(0)}/graphql`,
      postgres: `http://127.0.0.1:${18100 + name.charCodeAt(0)}/postgres`,
      hatchet: `http://127.0.0.1:${18200 + name.charCodeAt(0)}/health`,
      redis: `http://127.0.0.1:${18300 + name.charCodeAt(0)}/0`,
      blob: `http://127.0.0.1:${18400 + name.charCodeAt(0)}/blob`,
      ingestion: `http://127.0.0.1:${18500 + name.charCodeAt(0)}/ready`,
      dispatcher: `http://127.0.0.1:${18600 + name.charCodeAt(0)}/health`,
      callback: `http://127.0.0.1:${18700 + name.charCodeAt(0)}/metrics`,
      scraping: `http://127.0.0.1:${18800 + name.charCodeAt(0)}/ready`,
      crawl4ai: `http://127.0.0.1:${18900 + name.charCodeAt(0)}/health`,
      milvus: `http://127.0.0.1:${19000 + name.charCodeAt(0)}/healthz`,
      objectBacking: `http://127.0.0.1:${19100 + name.charCodeAt(0)}/health`,
      retrieval: `http://127.0.0.1:${19200 + name.charCodeAt(0)}/health`,
      docProcessing: `http://127.0.0.1:${19300 + name.charCodeAt(0)}/health`,
    },
  }
}

test('renders the pinned native command with the local crawl backend', () => {
  const config = resolveIsolatedConfig(makeInput('a'))
  const compose = renderScrapingCompose(config)
  const scraping = compose.services.scraping
  const crawl4ai = compose.services.crawl4ai

  assert.equal(
    scraping.image,
    'cr.gitlab.uzh.ch/ai-infrastructure/services/web-scraping@sha256:0dc1387e30c7228d8b156d8a874e4aa406e0c4a958480186db6801ea5dca1593'
  )
  assert.equal(scraping.user, 'app')
  assert.deepEqual(scraping.command, [
    'uvicorn',
    'web_scraping.main:app',
    '--host',
    '0.0.0.0',
    '--port',
    '8000',
    '--workers',
    '1',
  ])
  assert.deepEqual(scraping.environment, {
    PYTHON_DOTENV_DISABLED: '1',
    PYTHONDONTWRITEBYTECODE: '1',
    WEB_SCRAPING_EXECUTION_MODE: 'inline',
    WEB_SCRAPING_CRAWL4AI_API_URL: 'http://crawl4ai:11235',
    WEB_SCRAPING_CACHE_ROOT: '/app/data/cache',
    WEB_SCRAPING_CACHE_SWEEP_INTERVAL_SECONDS: '0',
  })
  assert.deepEqual(scraping.env_file, [
    {
      path: `${config.project.runtimeCheckoutPath}/.local-kb/scraping.env`,
      required: true,
    },
  ])
  assert.deepEqual(scraping.volumes, [
    {
      type: 'bind',
      source: `${config.providers.scraping.sourcePath}/src`,
      target: '/app/src',
      read_only: true,
      bind: { create_host_path: false },
    },
    'scraper-cache:/app/data',
  ])
  assert.equal(scraping.cpus, 1)
  assert.equal(scraping.mem_limit, '1g')
  assert.equal(scraping.pids_limit, 256)

  assert.equal(
    crawl4ai.image,
    'unclecode/crawl4ai@sha256:385042cba2a216c257ccb77b0135dec5228ee25bf675edbc7487eb155bd5e644'
  )
  assert.equal(crawl4ai.platform, 'linux/amd64')
  assert.equal(crawl4ai.shm_size, '1g')
  assert.equal(crawl4ai.user, undefined)
  assert.equal(crawl4ai.read_only, undefined)
  assert.deepEqual(crawl4ai.env_file, [
    {
      path: `${config.project.runtimeCheckoutPath}/.local-kb/crawl4ai.env`,
      required: true,
    },
  ])
  assert.equal(crawl4ai.cpus, 2)
  assert.equal(crawl4ai.mem_limit, '3g')
  assert.equal(crawl4ai.pids_limit, 512)
  assert.deepEqual(compose.volumes, {
    'scraper-cache': { name: config.mutableState.scraperCache.volumeName },
  })
})

test('rejects source mismatches and Compose interpolation or newline paths', () => {
  assert.throws(
    () =>
      renderScrapingCompose(
        resolveIsolatedConfig(makeInput('a', 'a'.repeat(40)))
      ),
    /pinned runtime images/
  )

  for (const pathValue of [
    '/synthetic/checkouts/a/runtime-$UNEXPECTED',
    '/synthetic/checkouts/a/runtime\nnewline',
  ]) {
    const input = makeInput('a')
    input.runtimeCheckoutPath = pathValue
    assert.throws(
      () => renderScrapingCompose(resolveIsolatedConfig(input)),
      /interpolation or newlines/
    )
  }
})

test('keeps cache volumes isolated and services on the default network only', () => {
  const first = renderScrapingCompose(resolveIsolatedConfig(makeInput('a')))
  const second = renderScrapingCompose(resolveIsolatedConfig(makeInput('b')))

  assert.notEqual(
    first.volumes['scraper-cache'].name,
    second.volumes['scraper-cache'].name
  )
  for (const service of Object.values(first.services)) {
    assert.equal(service.ports, undefined)
    assert.equal(service.network_mode, undefined)
    assert.deepEqual(service.networks, ['default'])
    assert.equal(service.aliases, undefined)
    assert.equal(service.restart, 'no')
  }
  assert.equal(first.networks, undefined)
})
