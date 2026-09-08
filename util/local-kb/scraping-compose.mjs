import { join } from 'node:path'
import { validateIsolatedConfig } from './isolated-config.mjs'

// These images were published from this exact provider revision. Source mounts
// must match their installed dependencies; a different revision needs new pins.
export const scrapingImageRevision = 'b6881533a97fbaa24e09f6fb05d0d99005231f2b' // gitleaks:allow -- Git revision, not a credential.
const scrapingImage =
  'cr.gitlab.uzh.ch/ai-infrastructure/services/web-scraping@sha256:0dc1387e30c7228d8b156d8a874e4aa406e0c4a958480186db6801ea5dca1593'
const crawl4aiImage =
  'unclecode/crawl4ai@sha256:385042cba2a216c257ccb77b0135dec5228ee25bf675edbc7487eb155bd5e644'

// A Compose fragment for the provider, not a standalone deployment. The
// backing services and generated environment files are owned by the caller.
export function renderScrapingCompose(config) {
  validateIsolatedConfig(config)
  const provider = config.providers.scraping
  if (provider.revision !== scrapingImageRevision) {
    throw new Error('Scraping source does not match the pinned runtime images.')
  }

  const checkout = config.project.runtimeCheckoutPath
  const generated = join(checkout, '.local-kb')
  if ([checkout, provider.sourcePath].some((path) => /[$\r\n]/.test(path))) {
    throw new Error('Compose paths must not contain interpolation or newlines.')
  }

  const bind = (source, target) => ({
    type: 'bind',
    source,
    target,
    read_only: true,
    bind: { create_host_path: false },
  })

  return {
    services: {
      scraping: {
        image: scrapingImage,
        working_dir: '/app',
        user: 'app',
        restart: 'no',
        cpus: 1,
        mem_limit: '1g',
        pids_limit: 256,
        networks: ['default'],
        depends_on: { crawl4ai: { condition: 'service_started' } },
        environment: {
          PYTHON_DOTENV_DISABLED: '1',
          PYTHONDONTWRITEBYTECODE: '1',
          WEB_SCRAPING_EXECUTION_MODE: 'inline',
          WEB_SCRAPING_CRAWL4AI_API_URL: 'http://crawl4ai:11235',
          WEB_SCRAPING_CACHE_ROOT: '/app/data/cache',
          WEB_SCRAPING_CACHE_SWEEP_INTERVAL_SECONDS: '0',
        },
        env_file: [{ path: join(generated, 'scraping.env'), required: true }],
        volumes: [
          bind(join(provider.sourcePath, 'src'), '/app/src'),
          'scraper-cache:/app/data',
        ],
        command: [
          'uvicorn',
          'web_scraping.main:app',
          '--host',
          '0.0.0.0',
          '--port',
          '8000',
          '--workers',
          '1',
        ],
      },
      crawl4ai: {
        image: crawl4aiImage,
        platform: 'linux/amd64',
        restart: 'no',
        cpus: 2,
        mem_limit: '3g',
        pids_limit: 512,
        shm_size: '1g',
        networks: ['default'],
        env_file: [{ path: join(generated, 'crawl4ai.env'), required: true }],
      },
    },
    volumes: {
      'scraper-cache': {
        name: config.mutableState.scraperCache.volumeName,
      },
    },
  }
}
