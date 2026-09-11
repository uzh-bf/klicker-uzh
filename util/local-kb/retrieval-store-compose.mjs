import { join } from 'node:path'
import { validateIsolatedConfig } from './isolated-config.mjs'

// Match the ingestion provider's Milvus standalone dependency versions.
export function renderRetrievalStoreCompose(config) {
  validateIsolatedConfig(config)
  const checkout = config.project.runtimeCheckoutPath
  if (/[$\r\n]/.test(checkout)) {
    throw new Error('Compose paths must not contain interpolation or newlines.')
  }
  const common = {
    restart: 'no',
    cpus: 1,
    mem_limit: '1g',
    pids_limit: 256,
    security_opt: ['no-new-privileges:true'],
    networks: ['default'],
  }
  return {
    services: {
      'milvus-etcd': {
        ...common,
        image: 'quay.io/coreos/etcd:v3.5.18',
        command: [
          'etcd',
          '-advertise-client-urls=http://milvus-etcd:2379',
          '-listen-client-urls=http://0.0.0.0:2379',
          '--data-dir=/etcd',
        ],
        volumes: ['milvus-metadata:/etcd'],
        environment: {
          ETCD_AUTO_COMPACTION_MODE: 'revision',
          ETCD_AUTO_COMPACTION_RETENTION: '1000',
          ETCD_QUOTA_BACKEND_BYTES: '4294967296',
          ETCD_SNAPSHOT_COUNT: '50000',
        },
        healthcheck: {
          test: ['CMD', 'etcdctl', 'endpoint', 'health'],
          interval: '10s',
          timeout: '5s',
          retries: 6,
        },
      },
      minio: {
        ...common,
        image: 'minio/minio:RELEASE.2024-12-18T13-15-44Z',
        command: ['minio', 'server', '/minio_data'],
        env_file: [
          { path: join(checkout, '.local-kb/minio.env'), required: true },
        ],
        volumes: ['object-backing:/minio_data'],
        healthcheck: {
          test: [
            'CMD',
            'curl',
            '-f',
            'http://localhost:9000/minio/health/live',
          ],
          interval: '10s',
          timeout: '5s',
          retries: 6,
        },
      },
      milvus: {
        ...common,
        image: 'milvusdb/milvus:v2.6.2',
        cpus: 2,
        mem_limit: '4g',
        pids_limit: 512,
        command: ['milvus', 'run', 'standalone'],
        environment: {
          ETCD_ENDPOINTS: 'milvus-etcd:2379',
          MINIO_ADDRESS: 'minio:9000',
          MQ_TYPE: 'woodpecker',
        },
        env_file: [
          { path: join(checkout, '.local-kb/milvus.env'), required: true },
        ],
        volumes: ['milvus:/var/lib/milvus'],
        depends_on: {
          'milvus-etcd': { condition: 'service_healthy' },
          minio: { condition: 'service_healthy' },
        },
        healthcheck: {
          test: ['CMD', 'curl', '-f', 'http://localhost:9091/healthz'],
          interval: '10s',
          timeout: '5s',
          retries: 30,
          start_period: '90s',
        },
      },
    },
    volumes: Object.fromEntries(
      [
        ['milvus', 'milvus'],
        ['milvus-metadata', 'milvusMetadata'],
        ['object-backing', 'objectBacking'],
      ].map(([name, state]) => [
        name,
        { name: config.mutableState[state].volumeName },
      ])
    ),
  }
}
