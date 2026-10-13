// Accepted argument surface of the provider-owned local launcher facades.
// Each entry is recorded from the provider repository at the revision below,
// so consumer assertions compare against the provider contract instead of
// against Klicker's own constants. Flags listed in `globalFlags` are declared
// on the launcher's top-level parser and must precede the verb; every other
// flag follows the verb.
export const LAUNCHER_CONTRACTS = {
  ingestion: {
    facade: 'scripts/local_launcher.py',
    revision: '6f0911f0f2536a52469791bce21461f29c22b17a',
    globalFlags: ['--strict'],
    verbs: {
      setup: {
        required: [
          '--instance',
          '--state-dir',
          '--config-dir',
          '--source-revision',
          '--state-dsn',
          '--web-scraping-base-url',
          '--openai-base-url',
          '--hatchet-http-port',
          '--hatchet-grpc-port',
          '--pgvector-port',
          '--azurite-port',
          '--milvus-port',
          '--milvus-health-port',
          '--milvus-attu-port',
        ],
        optional: [
          '--worker-image',
          '--project-configs-source',
          '--api-image',
          '--worker-env-file',
          '--api-env-file',
          '--producer-registry-dir',
          '--resource-api-port',
          '--dispatcher-port',
        ],
      },
      start: {
        required: [
          '--instance',
          '--state-dir',
          '--config-dir',
          '--source-revision',
        ],
        optional: ['--workers'],
      },
      status: {
        required: ['--instance', '--state-dir', '--config-dir'],
        optional: ['--source-revision'],
      },
      stop: {
        required: ['--instance', '--state-dir', '--config-dir'],
        optional: ['--source-revision'],
      },
    },
  },
  scraping: {
    facade: 'scripts/local_launcher.py',
    revision: '1771693cb86b228ae2147530b57eeab0d1c6e12b',
    globalFlags: [],
    verbs: {
      setup: {
        required: ['--instance'],
        optional: [
          '--state-root',
          '--port-base',
          '--api-port',
          '--crawl4ai-port',
          '--postgres-port',
          '--api-key-file',
        ],
      },
      start: { required: ['--instance'], optional: ['--state-root'] },
      status: { required: ['--instance'], optional: ['--state-root'] },
      stop: { required: ['--instance'], optional: ['--state-root'] },
    },
  },
  docProcessing: {
    facade: 'scripts/local_launcher.py',
    revision: 'b6448bf8d8d5ada2e99392877bb85f4e4d7a4c75',
    globalFlags: [],
    verbs: {
      setup: {
        required: ['--state-root', '--instance-id', '--source-revision'],
        optional: ['--owner-id', '--config', '--mode'],
      },
      start: {
        required: ['--state-root', '--instance-id', '--source-revision'],
        optional: ['--owner-id', '--config', '--mode'],
      },
      status: {
        required: ['--state-root', '--instance-id', '--source-revision'],
        optional: ['--owner-id', '--config', '--mode'],
      },
      stop: {
        required: ['--state-root', '--instance-id', '--source-revision'],
        optional: ['--owner-id', '--config', '--mode'],
      },
    },
  },
  retrieval: {
    facade: 'scripts/local_launcher.py',
    revision: 'd6e13ae72f77efb319f7b7a775c3a41980a6e700',
    globalFlags: [],
    // Bindings the launcher validates from its own process environment rather
    // than from a flag; an omitted one fails the service environment rather
    // than the argument parser.
    environment: ['milvus-uri', 'openai-base-url'],
    verbs: {
      setup: {
        required: [
          '--instance',
          '--source-revision',
          '--state-dir',
          '--config-dir',
          '--bind',
          '--port',
        ],
        optional: ['--env'],
      },
      start: {
        required: [
          '--instance',
          '--source-revision',
          '--state-dir',
          '--config-dir',
          '--bind',
          '--port',
        ],
        optional: ['--env'],
      },
      status: {
        required: [
          '--instance',
          '--source-revision',
          '--state-dir',
          '--config-dir',
          '--bind',
          '--port',
        ],
        optional: ['--env'],
      },
      stop: {
        required: [
          '--instance',
          '--source-revision',
          '--state-dir',
          '--config-dir',
          '--bind',
          '--port',
        ],
        optional: ['--env'],
      },
    },
  },
}
