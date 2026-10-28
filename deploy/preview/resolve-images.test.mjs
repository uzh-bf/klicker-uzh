import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  CONTROL_REF_NAME,
  createAdapter,
  REQUIRED_CONTEXTS,
  STAGING_CONTEXTS,
  TOKEN_NAME,
  WORKFLOW_PATH,
} from './resolve-images.mjs'

const { configurationDigest } = await import(
  '../../.github/scripts/preview-image-plan.cjs'
)

const revision = 'a'.repeat(40)
const controlRevision = 'b'.repeat(40)
const correlation = 'c'.repeat(64)
const digest = `sha256:${'d'.repeat(64)}`
const token = 'synthetic-token-value'

const workflow = `name: Build staging images
run-name: \${{ inputs.correlationId }}
on:
  workflow_dispatch:
    inputs:
      buildConfigurationJson:
        required: true
      correlationId:
        required: true
      platform:
        required: true
      sourceSha:
        required: true
      targets:
        required: true
concurrency:
  group: preview
`

function request(overrides = {}) {
  return {
    action: 'resolve',
    correlation,
    request: {
      revision,
      platform: 'linux/arm64',
      targets: [{ target: 'api', configuration: {} }],
    },
    producer: {
      repository: 'uzh-bf/klicker-uzh',
      workflow: WORKFLOW_PATH,
      controlRevision,
    },
    missing: ['api'],
    pinnedImages: [],
    ...overrides,
  }
}

function run({
  event = 'workflow_dispatch',
  sha = controlRevision,
  status = 'completed',
} = {}) {
  return {
    id: 101,
    run_attempt: 2,
    repository: { full_name: 'uzh-bf/klicker-uzh' },
    path: WORKFLOW_PATH,
    event,
    head_sha: sha,
    head_branch: 'v3-ai',
    display_title: correlation,
    status,
    conclusion: status === 'completed' ? 'success' : null,
  }
}

function checks(contexts, sha = revision) {
  return contexts.map((name, index) => ({
    id: index + 1,
    name,
    head_sha: sha,
    app: { slug: 'github-actions' },
    status: 'completed',
    conclusion: 'success',
    started_at: `2026-10-28T10:00:${String(index).padStart(2, '0')}Z`,
  }))
}

function job(name, sha, startedAt) {
  return {
    id: name.length * 100,
    run_id: 101,
    run_attempt: 2,
    name,
    head_sha: sha,
    status: 'completed',
    conclusion: 'success',
    started_at: startedAt,
  }
}

function artifact(name, id, createdAt) {
  return {
    id,
    name,
    expired: false,
    size_in_bytes: 100,
    created_at: createdAt,
  }
}

function scanReceipt({
  image,
  architecture = 'linux/arm64',
  sha = revision,
  imageDigest = digest,
} = {}) {
  return {
    schemaVersion: 'klicker.image-scan-receipt/v1',
    artifact: { image, digest: imageDigest, architecture },
    run: { id: '101', attempt: '2', gitSha: sha },
    scanner: { name: 'trivy' },
    policy: { failOn: ['HIGH', 'CRITICAL'], failOnUnfixed: false },
  }
}

function previewReceipt(overrides = {}) {
  return {
    revision,
    repository: 'uzh-bf/klicker-uzh',
    workflow: WORKFLOW_PATH,
    controlRevision,
    runId: '101',
    attempt: 2,
    target: 'api',
    platform: 'linux/arm64',
    configurationDigest: configurationDigest({}),
    inputFingerprint: `sha256:${'e'.repeat(64)}`,
    image: `ghcr.io/uzh-bf/klicker-uzh/preview-api@${digest}`,
    ciPassed: true,
    admissionPassed: true,
    ...overrides,
  }
}

function transportFor({
  runs = [],
  sourceChecks = checks(REQUIRED_CONTEXTS),
  jobs = [],
  artifacts = [],
  members = {},
  registry = {},
  metadata = {},
  workflowText = workflow,
} = {}) {
  const calls = []
  const artifactBytes = new Map()
  let nextArtifactId = 900

  function response(value) {
    return {
      stdout: Buffer.isBuffer(value)
        ? value
        : Buffer.from(JSON.stringify(value)),
    }
  }

  function memberBytes(value) {
    const bytes = Buffer.from(`artifact-${nextArtifactId++}`)
    artifactBytes.set(bytes.toString(), value)
    return bytes
  }

  const transport = {
    run(command, args, options = {}) {
      calls.push({ command, args, options })
      if (command === 'docker') {
        if (args.at(-1) === '--raw') {
          const reference = args[3]
          return response(
            registry[reference] ?? {
              manifests: [{ platform: { os: 'linux', architecture: 'arm64' } }],
            }
          )
        }
        if (args.includes('--format')) {
          const reference = args[3]
          return response(metadata[reference] ?? {})
        }
        throw new Error('unexpected docker command')
      }
      if (command !== 'gh') throw new Error(`unexpected command ${command}`)
      if (args[0] === 'workflow' && args[1] === 'run') return response({})

      const endpoint = args[3]
      if (endpoint === undefined) throw new Error('missing gh endpoint')
      const queryStart = endpoint.indexOf('?page=')
      const path = queryStart < 0 ? endpoint : endpoint.slice(0, queryStart)

      if (path.endsWith('/commits/v3-ai'))
        return response({ sha: controlRevision })
      if (path.includes('/contents/')) {
        return { stdout: Buffer.from(workflowText) }
      }
      if (path.includes('/check-runs'))
        return response({ check_runs: sourceChecks })
      if (path.includes('/attempts/') && path.endsWith('/jobs')) {
        return response({ jobs })
      }
      if (path.endsWith('/artifacts')) return response({ artifacts })
      if (path.includes('/actions/artifacts/') && path.endsWith('/zip')) {
        const id = Number(path.split('/').at(-2))
        const bytes = memberBytes(members[id] ?? {})
        return response(bytes)
      }
      if (path.endsWith('/actions/runs'))
        return response({ workflow_runs: runs })
      if (path.endsWith('/runs') || path.includes('/runs?')) {
        return response({ workflow_runs: runs })
      }
      throw new Error(`unexpected gh endpoint ${endpoint}`)
    },
  }

  return {
    calls,
    extractArtifact(bytes, member) {
      const value = artifactBytes.get(bytes.toString())
      if (value === undefined) throw new Error('unknown artifact')
      if (!(member in value)) throw new Error('unknown artifact member')
      return typeof value[member] === 'string'
        ? value[member]
        : JSON.stringify(value[member])
    },
    transport,
  }
}

function adapterFor(fixture, options = {}) {
  return createAdapter({
    environment: {
      [TOKEN_NAME]: token,
      [CONTROL_REF_NAME]: 'v3-ai',
    },
    transport: fixture.transport,
    extractArtifact: fixture.extractArtifact,
    validateWorkflow: () => {},
    ...options,
  })
}

test('reuses an exact staging fingerprint adoption without dispatching', async () => {
  const stagingDigest = `sha256:${'f'.repeat(64)}`
  const stagingImage = `ghcr.io/uzh-bf/klicker-uzh/backend-docker-arm@${stagingDigest}`
  const buildJob = job(
    'build-arm-backend-docker',
    revision,
    '2026-10-28T10:00:00Z'
  )
  const scanJob = job(
    'scan-arm-backend-docker',
    revision,
    '2026-10-28T10:01:00Z'
  )
  const statusJob = job('build-images-status', revision, '2026-10-28T10:03:00Z')
  const fixture = transportFor({
    runs: [run({ event: 'push', sha: revision })],
    sourceChecks: checks(STAGING_CONTEXTS),
    jobs: [buildJob, scanJob, statusJob],
    artifacts: [
      artifact('build-digest-backend-docker-arm', 201, '2026-10-28T10:00:30Z'),
      artifact('image-scan-backend-docker-arm', 202, '2026-10-28T10:01:30Z'),
    ],
    members: {
      201: {
        'digest.txt': stagingDigest,
        'image-input-fingerprint-backend-docker-arm.json': {
          target: 'backend-docker-arm',
          fingerprint: `sha256:${'1'.repeat(64)}`,
          tag: `fp-${'1'.repeat(64)}`,
        },
        'image-reuse-backend-docker-arm.json': {
          adopted: true,
          digest: stagingDigest,
          schemaVersion: 1,
          tag: `fp-${'1'.repeat(64)}`,
        },
      },
      202: {
        'image-scan-backend-docker-arm-receipt.json': scanReceipt({
          image: stagingImage,
          imageDigest: stagingDigest,
        }),
      },
    },
    registry: {
      [stagingImage]: {
        manifests: [{ platform: { os: 'linux', architecture: 'arm64' } }],
      },
    },
  })

  const result = await adapterFor(fixture).execute(JSON.stringify(request()))

  assert.equal(result.pending, false)
  assert.equal(result.receipts.length, 1)
  assert.equal(result.receipts[0].image, stagingImage)
  assert.equal(result.receipts[0].controlRevision, controlRevision)
  assert.equal(
    fixture.calls.filter(
      ({ command, args }) => command === 'gh' && args[0] === 'workflow'
    ).length,
    0
  )
  assert.ok(
    fixture.calls
      .filter(({ command }) => command === 'gh')
      .every(
        ({ args, options }) =>
          options.env?.GH_TOKEN === token &&
          !args.some((arg) => arg.includes(token))
      )
  )
})

test('pending correlated run returns pending without dispatching', async () => {
  const fixture = transportFor({ runs: [run({ status: 'in_progress' })] })
  const result = await adapterFor(fixture).execute(JSON.stringify(request()))

  assert.deepEqual(result, { receipts: [], pending: true })
  assert.equal(
    fixture.calls.filter(
      ({ args }) => args[0] === 'workflow' && args[1] === 'run'
    ).length,
    0
  )
})

test('no existing image returns an empty result for the backend to dispatch', async () => {
  const fixture = transportFor({ runs: [] })
  const result = await adapterFor(fixture).execute(
    JSON.stringify(
      request({
        request: {
          revision,
          platform: 'linux/arm64',
          targets: [{ target: 'fixtures', configuration: {} }],
        },
        missing: ['fixtures'],
      })
    )
  )

  assert.deepEqual(result, { receipts: [], pending: false })
})

test('dispatch uses the reviewed workflow with exact selective inputs', async () => {
  const fixture = transportFor()
  const result = await adapterFor(fixture).execute(
    JSON.stringify(
      request({
        action: 'dispatch',
        request: {
          revision,
          platform: 'linux/amd64',
          targets: [{ target: 'api', configuration: { FEATURE_FLAG: 'true' } }],
        },
      })
    )
  )

  assert.deepEqual(result, {})
  const dispatch = fixture.calls.find(
    ({ args }) => args[0] === 'workflow' && args[1] === 'run'
  )
  assert.ok(dispatch)
  assert.deepEqual(dispatch.args.slice(2), [
    'v3_images-stg.yml',
    '--repo',
    'uzh-bf/klicker-uzh',
    '--ref',
    'v3-ai',
    '--field',
    'buildConfigurationJson={"api":{"FEATURE_FLAG":"true"}}',
    '--field',
    `correlationId=${correlation}`,
    '--field',
    'platform=linux/amd64',
    '--field',
    `sourceSha=${revision}`,
    '--field',
    'targets=api',
  ])
})

test('source admission requires every trusted context on the requested SHA', async () => {
  const sourceChecks = checks(REQUIRED_CONTEXTS).map((check, index) =>
    index === 0 ? { ...check, conclusion: 'failure' } : check
  )
  const fixture = transportFor({ runs: [], sourceChecks })

  await assert.rejects(
    adapterFor(fixture).execute(
      JSON.stringify(
        request({
          request: {
            revision,
            platform: 'linux/arm64',
            targets: [{ target: 'fixtures', configuration: {} }],
          },
          missing: ['fixtures'],
        })
      )
    ),
    /source check check is completed\/failure/
  )
})

test('preview receipts must bind source, configuration and architecture', async () => {
  async function resolveWith(
    receipt,
    scan = undefined,
    scanCreatedAt = '2026-10-28T10:01:30Z'
  ) {
    const build = job(
      'preview-api-arm64',
      controlRevision,
      '2026-10-28T10:00:00Z'
    )
    const scanJob = job(
      'preview-scan-api',
      controlRevision,
      '2026-10-28T10:01:00Z'
    )
    const finalize = job(
      'preview-finalize',
      controlRevision,
      '2026-10-28T10:02:00Z'
    )
    const image = receipt.image
    const fixture = transportFor({
      runs: [run()],
      jobs: [build, scanJob, finalize],
      artifacts: [
        artifact('preview-scan-api', 301, scanCreatedAt),
        artifact(`preview-images-${correlation}`, 302, '2026-10-28T10:02:30Z'),
      ],
      members: {
        301: {
          'image-scan-api-receipt.json': scan ?? scanReceipt({ image }),
        },
        302: { 'preview-images.json': { receipts: [receipt] } },
      },
      registry: {
        [image]: {
          manifests: [{ platform: { os: 'linux', architecture: 'arm64' } }],
        },
      },
    })
    return adapterFor(fixture).execute(
      JSON.stringify(request({ pinnedImages: [image] }))
    )
  }

  const accepted = await resolveWith(previewReceipt())
  assert.equal(accepted.receipts.length, 1)
  assert.equal(accepted.receipts[0].revision, revision)
  await assert.rejects(
    resolveWith(previewReceipt({ revision: '9'.repeat(40) })),
    /receipt revision differs/
  )
  await assert.rejects(
    resolveWith(
      previewReceipt({ configurationDigest: `sha256:${'8'.repeat(64)}` })
    ),
    /receipt configurationDigest differs/
  )
  await assert.rejects(
    resolveWith(previewReceipt({ attempt: 1 })),
    /receipt attempt differs/
  )
  const staleScan = scanReceipt({ image: previewReceipt().image })
  staleScan.run.attempt = '1'
  await assert.rejects(
    resolveWith(previewReceipt(), staleScan),
    (error) => error.code === 'scan_admission_missing'
  )
  await assert.rejects(
    resolveWith(previewReceipt(), undefined, '2026-10-28T10:00:30Z'),
    (error) => error.code === 'artifact_mismatch'
  )
  await assert.rejects(
    resolveWith(
      previewReceipt(),
      scanReceipt({
        image: previewReceipt().image,
        architecture: 'linux/amd64',
      })
    ),
    /wrong platform/
  )
})

test('pinned and admitted images must prove the requested OCI platform', async () => {
  const image = `ghcr.io/example/runtime@${digest}`
  const fixture = transportFor({
    registry: {
      [image]: {
        manifests: [
          { platform: { os: 'linux', architecture: 'amd64' } },
          { platform: { os: 'unknown', architecture: 'unknown' } },
        ],
      },
    },
  })

  await assert.rejects(
    adapterFor(fixture).execute(
      JSON.stringify(request({ pinnedImages: [image] }))
    ),
    /does not contain exactly one linux\/arm64 manifest/
  )
})

test('single-manifest architecture fails closed when metadata cannot prove it', async () => {
  const image = `ghcr.io/example/runtime@${digest}`
  const fixture = transportFor({
    registry: { [image]: { config: {} } },
    metadata: {
      [image]: { Platform: { os: 'linux', architecture: 'unknown' } },
    },
  })

  await assert.rejects(
    adapterFor(fixture).execute(
      JSON.stringify(request({ pinnedImages: [image] }))
    ),
    /cannot prove linux\/arm64/
  )
})

test('a completed preview with empty evidence is rejected', async () => {
  const build = job(
    'preview-api-arm64',
    controlRevision,
    '2026-10-28T10:00:00Z'
  )
  const scan = job('preview-scan-api', controlRevision, '2026-10-28T10:01:00Z')
  const finalize = job(
    'preview-finalize',
    controlRevision,
    '2026-10-28T10:02:00Z'
  )
  const fixture = transportFor({
    runs: [run()],
    jobs: [build, scan, finalize],
    artifacts: [
      artifact(`preview-images-${correlation}`, 401, '2026-10-28T10:02:30Z'),
    ],
    members: { 401: { 'preview-images.json': { receipts: [] } } },
  })

  await assert.rejects(
    adapterFor(fixture).execute(JSON.stringify(request())),
    /carries no image receipts/
  )
})

test('a newer skipped preview status does not shadow the required build status', async () => {
  const sourceChecks = [
    ...checks(REQUIRED_CONTEXTS),
    {
      id: 9999,
      name: 'preview-build-images-status',
      head_sha: revision,
      app: { slug: 'github-actions' },
      status: 'completed',
      conclusion: 'skipped',
      started_at: '2026-10-28T10:01:00Z',
    },
  ]
  const fixture = transportFor({ runs: [], sourceChecks })
  const result = await adapterFor(fixture).execute(
    JSON.stringify(
      request({
        request: {
          revision,
          platform: 'linux/amd64',
          targets: [{ target: 'fixtures', configuration: {} }],
        },
        missing: [],
      })
    )
  )

  assert.deepEqual(result, { receipts: [], pending: false })
})

test('a newer queued source check blocks an older completed success', async () => {
  const sourceChecks = [
    ...checks(REQUIRED_CONTEXTS),
    {
      id: 9999,
      name: 'check',
      head_sha: revision,
      app: { slug: 'github-actions' },
      status: 'queued',
      conclusion: null,
      started_at: null,
    },
  ]
  const fixture = transportFor({ runs: [], sourceChecks })
  await assert.rejects(
    adapterFor(fixture).execute(
      JSON.stringify(
        request({
          request: {
            revision,
            platform: 'linux/amd64',
            targets: [{ target: 'fixtures', configuration: {} }],
          },
          missing: [],
        })
      )
    ),
    (error) => error.code === 'source_ci_blocked'
  )
})

test('single-manifest pinned images use their actual top-level OCI architecture', async () => {
  const image = `registry.example/mail@sha256:${'8'.repeat(64)}`
  const fixture = transportFor({
    runs: [],
    registry: { [image]: { config: { digest: `sha256:${'7'.repeat(64)}` } } },
    metadata: { [image]: { os: 'linux', architecture: 'amd64' } },
  })
  const result = await adapterFor(fixture).execute(
    JSON.stringify(
      request({
        request: {
          revision,
          platform: 'linux/amd64',
          targets: [{ target: 'fixtures', configuration: {} }],
        },
        missing: [],
        pinnedImages: [image],
      })
    )
  )
  assert.deepEqual(result, { receipts: [], pending: false })
})
