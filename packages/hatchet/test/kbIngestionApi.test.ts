import { BlobServiceClient } from '@azure/storage-blob'
import type { IngestKBResourceInput } from '@klicker-uzh/types'
import { Readable } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildKBIngestionSource,
  createKBIngestionApiClient,
  prepareKBIngestionSource,
  resolvePublicIPv4,
} from '../src/kbIngestionApi.js'

const RESOURCE_ID = '7f3e2a10-9c4b-4d8e-b1a6-5e0f9d2c7b3a'
const KB_ID = 'c2a91f74-6e0b-4c3d-8f5a-1b9e7d4a2c60'
const ATTEMPT_ID = 'b5d4c3a2-1f0e-4d9c-8b7a-6e5f4d3c2b1a'
const CONTENT_SHA256 =
  '9b74c9897bac770ffc029102a200c5de11ba9dbd0e0f28c991eb64b0fb54d96e'

const env = {
  KB_INGESTION_API_URL: 'https://ingestion.example',
  KB_INGESTION_API_KEY: 'api-key',
  KB_SOURCE_GATEWAY_URL: 'http://klicker-backend.stg-klicker.svc:3000',
  BLOB_STORAGE_ACCOUNT_NAME: 'kbaccount',
  BLOB_STORAGE_ACCESS_KEY: Buffer.alloc(32).toString('base64'),
}

const source = {
  kind: 'blob',
  url: `http://klicker-backend.stg-klicker.svc:3000/api/ingestion/resources/${RESOURCE_ID}/versions/3`,
  mimeType: 'application/pdf',
  displayName: 'Lecture 1',
  contentSha256: CONTENT_SHA256,
  sizeBytes: 1024,
} as const

const operationResponse = {
  operation_id: 'op_01J2X8K3M9QZ4R7T6V5W1Y0BND',
  status: 'succeeded',
  operation: 'update',
  project_id: 'klicker-course-materials',
  producer: 'klicker',
  external_resource_id: RESOURCE_ID,
  resource_version: 3,
  expected_sha256: CONTENT_SHA256,
  observed_sha256: CONTENT_SHA256,
  serving: {
    active_resource_version: 3,
    active_sha256: CONTENT_SHA256,
  },
  error_code: null,
  correlation_id: ATTEMPT_ID,
  created_at: '2026-07-12T14:03:21Z',
  updated_at: '2026-07-12T14:04:52Z',
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('canonical ingestion API client', () => {
  it('sends the create fixture field-for-field and awaits 202 acceptance', async () => {
    const fetchRequest = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: vi.fn().mockResolvedValue({
        operation_id: 'op_01J2X8K3M9QZ4R7T6V5W1Y0BND',
      }),
    })
    const client = createKBIngestionApiClient({
      env,
      fetchRequest,
    })

    await expect(
      client.acceptResource({
        resourceId: RESOURCE_ID,
        kbId: KB_ID,
        resourceVersion: 3,
        ingestionAttemptId: ATTEMPT_ID,
        source,
      })
    ).resolves.toBe('op_01J2X8K3M9QZ4R7T6V5W1Y0BND')

    expect(fetchRequest).toHaveBeenCalledOnce()
    const [url, request] = fetchRequest.mock.calls[0]!
    expect(url.toString()).toBe('https://ingestion.example/v1/resources')
    expect(request).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer api-key',
        'Content-Type': 'application/json',
        'Idempotency-Key': ATTEMPT_ID,
      },
    })
    expect(JSON.parse(request.body)).toEqual({
      project_id: 'klicker-course-materials',
      producer: 'klicker',
      external_resource_id: RESOURCE_ID,
      resource_version: 3,
      scope: { kb_id: KB_ID },
      source: {
        kind: 'blob',
        url: source.url,
        mime_type: 'application/pdf',
        display_name: 'Lecture 1',
      },
      content_sha256: CONTENT_SHA256,
    })
  })

  it('sends the canonical delete request with a stable idempotency key', async () => {
    const fetchRequest = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: vi.fn().mockResolvedValue({
        operation_id: 'op_01J2X8K3M9QZ4R7T6V5W1Y0BND',
      }),
    })
    const client = createKBIngestionApiClient({ env, fetchRequest })

    await expect(
      client.deleteResource({
        resourceId: RESOURCE_ID,
        kbId: KB_ID,
        resourceVersion: 4,
        deletionAttemptId: ATTEMPT_ID,
      })
    ).resolves.toBe('op_01J2X8K3M9QZ4R7T6V5W1Y0BND')

    const [url, request] = fetchRequest.mock.calls[0]!
    expect(url.toString()).toBe(
      `https://ingestion.example/v1/resources/${RESOURCE_ID}`
    )
    expect(request).toMatchObject({
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer api-key',
        'Content-Type': 'application/json',
        'Idempotency-Key': ATTEMPT_ID,
      },
    })
    expect(JSON.parse(request.body)).toEqual({
      project_id: 'klicker-course-materials',
      producer: 'klicker',
      resource_version: 4,
      scope: { kb_id: KB_ID },
    })
  })

  it('parses the canonical operation response for reconciliation', async () => {
    const fetchRequest = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(operationResponse),
    })

    await expect(
      createKBIngestionApiClient({ env, fetchRequest }).getOperation(
        'op_01J2X8K3M9QZ4R7T6V5W1Y0BND'
      )
    ).resolves.toEqual({
      operationId: 'op_01J2X8K3M9QZ4R7T6V5W1Y0BND',
      status: 'succeeded',
      operation: 'update',
      projectId: 'klicker-course-materials',
      producer: 'klicker',
      externalResourceId: RESOURCE_ID,
      resourceVersion: 3,
      expectedSha256: CONTENT_SHA256,
      observedSha256: CONTENT_SHA256,
      serving: {
        activeResourceVersion: 3,
        activeSha256: CONTENT_SHA256,
      },
      errorCode: null,
      correlationId: ATTEMPT_ID,
      createdAt: '2026-07-12T14:03:21Z',
      updatedAt: '2026-07-12T14:04:52Z',
    })
  })

  it('rejects response drift and hides remote response details', async () => {
    const fetchRequest = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: vi.fn().mockResolvedValue({
        operation_id: 'operation-id',
        unexpected: true,
      }),
    })

    await expect(
      createKBIngestionApiClient({ env, fetchRequest }).acceptResource({
        resourceId: RESOURCE_ID,
        kbId: KB_ID,
        resourceVersion: 3,
        ingestionAttemptId: ATTEMPT_ID,
        source,
      })
    ).rejects.toThrow('Ingestion API returned an invalid response')
  })

  it('rejects a successful response with the wrong endpoint status', async () => {
    const fetchRequest = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        operation_id: 'op_01J2X8K3M9QZ4R7T6V5W1Y0BND',
      }),
    })

    await expect(
      createKBIngestionApiClient({ env, fetchRequest }).acceptResource({
        resourceId: RESOURCE_ID,
        kbId: KB_ID,
        resourceVersion: 3,
        ingestionAttemptId: ATTEMPT_ID,
        source,
      })
    ).rejects.toThrow('Ingestion API request failed')
  })

  it('rejects timestamps without the contract-required timezone', async () => {
    const fetchRequest = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        ...operationResponse,
        created_at: '2026-07-12T14:03:21',
      }),
    })

    await expect(
      createKBIngestionApiClient({ env, fetchRequest }).getOperation(
        operationResponse.operation_id
      )
    ).rejects.toThrow('Ingestion API returned an invalid response')
  })

  it.each([{ status: ['succeeded'] }, { operation: ['update'] }])(
    'rejects non-string operation enums',
    async (override) => {
      const fetchRequest = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          ...operationResponse,
          ...override,
        }),
      })

      await expect(
        createKBIngestionApiClient({ env, fetchRequest }).getOperation(
          operationResponse.operation_id
        )
      ).rejects.toThrow('Ingestion API returned an invalid response')
    }
  )
})

describe('ingestion source preparation', () => {
  const blobInput = {
    resourceId: RESOURCE_ID,
    kbId: KB_ID,
    title: 'Lecture 1',
    ingestionAttemptId: ATTEMPT_ID,
    resourceVersion: 3,
    type: 'BLOB',
    containerName: 'kb-owner',
    blobName: `${RESOURCE_ID}.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: 7,
  } satisfies IngestKBResourceInput

  it('hashes immutable blob bytes and builds the authenticated gateway URL', async () => {
    const getBlobClient = vi.fn().mockReturnValue({
      download: vi.fn().mockResolvedValue({
        contentLength: 7,
        contentType: 'application/pdf',
        readableStreamBody: Readable.from([Buffer.from('lecture')]),
      }),
    })
    vi.spyOn(BlobServiceClient.prototype, 'getContainerClient').mockReturnValue(
      { getBlobClient } as never
    )

    await expect(prepareKBIngestionSource(blobInput, env)).resolves.toEqual({
      kind: 'blob',
      url: source.url,
      mimeType: 'application/pdf',
      displayName: 'Lecture 1',
      contentSha256:
        '6bc636ff0103a2888fb38ca3c2bf3b1371110ceac5a104a519d85d39207732b0',
      sizeBytes: 7,
    })
  })

  it('pins every public URL hop and hashes only supported response bytes', async () => {
    const urlInput = {
      resourceId: RESOURCE_ID,
      kbId: KB_ID,
      title: 'Lecture notes',
      ingestionAttemptId: ATTEMPT_ID,
      resourceVersion: 3,
      type: 'URL',
      sourceUrl: 'https://example.com/notes',
    } satisfies IngestKBResourceInput
    const redirect = Object.assign(Readable.from([]), {
      statusCode: 302,
      headers: { location: 'https://cdn.example.com/notes.txt' },
    })
    const content = Object.assign(Readable.from([Buffer.from('notes')]), {
      statusCode: 200,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'content-length': '5',
      },
    })
    const resolvePublicIPv4 = vi
      .fn()
      .mockResolvedValueOnce('93.184.216.34')
      .mockResolvedValueOnce('93.184.216.35')
    const requestPinnedUrl = vi
      .fn()
      .mockResolvedValueOnce(redirect)
      .mockResolvedValueOnce(content)

    await expect(
      prepareKBIngestionSource(urlInput, env, {
        resolvePublicIPv4,
        requestPinnedUrl,
      })
    ).resolves.toEqual({
      kind: 'url',
      url: 'https://example.com/notes',
      mimeType: 'text/plain',
      displayName: 'Lecture notes',
      contentSha256:
        'ab5aa97074c454a0632057e704220d9a6678fbf773a0a5806fc09b8173b07309',
      sizeBytes: 5,
    })
    expect(resolvePublicIPv4).toHaveBeenNthCalledWith(1, 'example.com')
    expect(resolvePublicIPv4).toHaveBeenNthCalledWith(2, 'cdn.example.com')
    expect(requestPinnedUrl).toHaveBeenNthCalledWith(
      1,
      new URL('https://example.com/notes'),
      '93.184.216.34'
    )
  })

  it('rejects persisted source identity with a non-canonical digest', () => {
    expect(() =>
      buildKBIngestionSource(
        blobInput,
        'application/pdf',
        'not-a-digest',
        1024,
        env
      )
    ).toThrow('KB ingestion source is invalid')
  })
})

// The test above exercises `preparePublicUrlSource` only through injected
// `resolvePublicIPv4`/`requestPinnedUrl` fakes, so the real DNS-rebinding
// guard in `resolvePublicIPv4` (SSRF protection: reject loopback, private,
// and link-local/metadata addresses even when they arrive via a normal-
// looking hostname) never actually ran. `resolvePublicIPv4` was exported
// (pure `export` keyword addition, no logic change) so it can be called
// directly here. Every case below is self-contained: `dns.lookup()` never
// performs a network round trip for an IP-literal "hostname" -- Node
// resolves it locally regardless of family -- so this needs no external
// DNS or network egress, verified empirically (0ms lookups) before writing
// these tests.
describe('resolvePublicIPv4 SSRF guard (real function, no fakes)', () => {
  it.each([
    ['localhost', 'loopback hostname (resolves to 127.0.0.1 locally)'],
    ['127.0.0.1', 'loopback literal'],
    ['10.0.0.1', 'private class A'],
    ['192.168.1.1', 'private class C'],
    ['169.254.169.254', 'link-local / cloud metadata address'],
  ])('rejects %s (%s)', async (hostname) => {
    await expect(resolvePublicIPv4(hostname)).rejects.toThrow(
      'KB ingestion source URL is invalid'
    )
  })

  it('rejects an IPv6 literal presented as the hostname', async () => {
    // Node's dns.lookup(hostname, { family: 4 }) does NOT fail or filter an
    // IP-literal "hostname" to family 4 -- for a literal address it just
    // returns that address verbatim, family 6 and all (confirmed directly:
    // `dns.lookup('::1', { all: true, family: 4 })` resolves to
    // `[{ address: '::1', family: 6 }]`, not an error and not an IPv4
    // address). The real rejection therefore has to come from the
    // `isPublicIPv4Address` classification afterwards (it requires
    // `isIP(value) === 4`), not from the forced-family lookup itself. This
    // pins that the real function still rejects it end to end.
    await expect(resolvePublicIPv4('::1')).rejects.toThrow(
      'KB ingestion source URL is invalid'
    )
  })

  it('accepts a public IPv4 literal, exercising the real classification logic with no DNS/network dependency', async () => {
    // dns.lookup() short-circuits for IP literals without any I/O (0ms in a
    // local trial), so this is not a disguised real-network test -- it
    // proves the real success path of resolvePublicIPv4 deterministically.
    await expect(resolvePublicIPv4('93.184.216.34')).resolves.toBe(
      '93.184.216.34'
    )
  })
})
