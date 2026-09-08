import { join } from 'node:path'
import { validateIsolatedConfig } from './isolated-config.mjs'

// This fragment is used only after exclusive preparation has claimed the
// runtime's volume identities and generated its local-only configuration.
export function renderBackingCompose(config) {
  validateIsolatedConfig(config)
  const checkout = config.project.runtimeCheckoutPath
  if (/[$\r\n]/.test(checkout)) {
    throw new Error('Compose paths must not contain interpolation or newlines.')
  }
  const directory = join(checkout, '.local-kb')
  const bind = (source, target) => ({
    type: 'bind',
    source,
    target,
    read_only: true,
    bind: { create_host_path: false },
  })
  const environmentFile = (name) => [
    { path: join(directory, `${name}.env`), required: true },
  ]
  const common = {
    restart: 'no',
    cpus: 1,
    mem_limit: '1g',
    pids_limit: 256,
    security_opt: ['no-new-privileges:true'],
    networks: ['default'],
  }
  const hatchet = {
    ...common,
    image: 'ghcr.io/hatchet-dev/hatchet/hatchet-lite-dev:v0.101.0',
    working_dir: '/',
    read_only: true,
    cap_drop: ['ALL'],
    tmpfs: ['/tmp:rw,nosuid,nodev,size=67108864,mode=1777'],
    env_file: environmentFile('hatchet'),
    entrypoint: ['bash', '/local-kb/hatchet-entrypoint.sh'],
    volumes: [
      'hatchet-config:/config',
      bind(
        join(checkout, 'util/local-kb/hatchet-entrypoint.sh'),
        '/local-kb/hatchet-entrypoint.sh'
      ),
    ],
    depends_on: { postgres: { condition: 'service_healthy' } },
  }
  return {
    services: {
      postgres: {
        ...common,
        image: 'postgres:15',
        env_file: environmentFile('postgres'),
        volumes: [
          'postgres:/var/lib/postgresql/data',
          bind(join(directory, 'postgres-init'), '/docker-entrypoint-initdb.d'),
        ],
        healthcheck: {
          test: [
            'CMD-SHELL',
            'pg_isready -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"',
          ],
          interval: '5s',
          timeout: '3s',
          retries: 20,
        },
      },
      redis: {
        ...common,
        image: 'redis:7',
        read_only: true,
        command: ['redis-server', '--appendonly', 'yes'],
        volumes: ['redis:/data'],
        healthcheck: {
          test: ['CMD', 'redis-cli', 'ping'],
          interval: '5s',
          timeout: '3s',
          retries: 20,
        },
      },
      blob: {
        ...common,
        image: 'mcr.microsoft.com/azure-storage/azurite:3.36.0',
        env_file: environmentFile('blob'),
        read_only: true,
        cap_drop: ['ALL'],
        command: [
          'azurite-blob',
          '--blobHost',
          '0.0.0.0',
          '--blobPort',
          '10000',
          '--location',
          '/data',
          '--disableProductStyleUrl',
          '--disableTelemetry',
        ],
        volumes: ['blob:/data'],
        healthcheck: {
          test: [
            'CMD',
            'node',
            '-e',
            "const http = require('node:http'); const request = http.get('http://127.0.0.1:10000/klickerdev?comp=list', response => { response.resume(); process.exit(response.statusCode === 403 ? 0 : 1) }); request.on('error', () => process.exit(1)); request.setTimeout(2000, () => request.destroy())",
          ],
          interval: '5s',
          timeout: '3s',
          retries: 24,
        },
      },
      'hatchet-setup': {
        ...hatchet,
        command: ['setup'],
        profiles: ['local-kb-setup'],
      },
      hatchet: { ...hatchet, command: ['start'] },
    },
    volumes: Object.fromEntries(
      [
        ['postgres', 'postgres'],
        ['redis', 'redis'],
        ['blob', 'blob'],
        ['hatchet-config', 'hatchetConfig'],
      ].map(([name, state]) => [
        name,
        { name: config.mutableState[state].volumeName },
      ])
    ),
  }
}
