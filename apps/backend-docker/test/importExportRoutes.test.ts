import { ImportExportErrorCode } from '@klicker-uzh/graphql'
import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import express from 'express'
import { GraphQLError } from 'graphql'
import assert from 'node:assert/strict'
import { Agent, createServer, request as httpRequest } from 'node:http'
import { connect } from 'node:net'
import { afterEach, describe, it } from 'node:test'
import {
  registerImportExportPreflightRoute,
  registerImportExportRoutes,
  type ImportExportRouteContext,
  type ImportExportRouteServices,
} from '../src/importExportRoutes.js'

const MANAGE_ORIGIN = 'https://manage.klicker.localhost'
const ARTIFACT_ID = '00000000-0000-4000-8000-000000000001'
const AUTHENTICATED_USER = {
  sub: 'user-1',
  role: UserRole.USER,
  scope: UserLoginScope.FULL_ACCESS,
  catalystInstitutional: false,
  catalystIndividual: false,
}

type HttpResult = {
  status: number
  headers: Record<string, string | string[] | undefined>
  body: string
}

type Harness = Awaited<ReturnType<typeof createHarness>>
const activeHarnesses = new Set<Harness>()

afterEach(async () => {
  await Promise.all([...activeHarnesses].map((harness) => harness.close()))
  activeHarnesses.clear()
})

function createDefaultServices(): ImportExportRouteServices {
  return {
    uploadPreparedElementImportPackage: async ({ contentLength, stream }) => {
      let bytes = 0
      for await (const chunk of stream) {
        bytes += Buffer.from(chunk).length
      }
      assert.equal(bytes, contentLength)
      return { bytes, sha256: 'uploaded-sha256', replayed: false }
    },
    downloadLocalElementExportPackage: async () => Buffer.from('zip'),
    getLocalImportedMediaDownload: async () => null,
  }
}

async function createHarness({
  user = AUTHENTICATED_USER as unknown,
  uploadBodyTimeoutMs,
  serviceOverrides = {},
}: {
  user?: unknown
  uploadBodyTimeoutMs?: number
  serviceOverrides?: Partial<ImportExportRouteServices>
} = {}) {
  const app = express()
  registerImportExportPreflightRoute(app, { manageOrigin: MANAGE_ORIGIN })
  app.use((req, _res, next) => {
    req.locals = { user }
    next()
  })

  const context = { prisma: {} } as unknown as ImportExportRouteContext
  const services = { ...createDefaultServices(), ...serviceOverrides }
  registerImportExportRoutes(app, {
    context,
    manageOrigin: MANAGE_ORIGIN,
    localStorageEnabled: true,
    uploadBodyTimeoutMs,
    services,
  })

  const server = createServer(app)
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  assert(address && typeof address === 'object')

  const harness = {
    port: address.port,
    async close() {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
        server.closeAllConnections()
      })
    },
  }
  activeHarnesses.add(harness)
  return harness
}

function request(
  port: number,
  {
    method = 'PUT',
    path = `/api/import-export-packages/${ARTIFACT_ID}/upload`,
    headers = {},
    body,
  }: {
    method?: string
    path?: string
    headers?: Record<string, string>
    body?: string | Buffer
  } = {}
) {
  const agent = new Agent({ keepAlive: true })

  return new Promise<HttpResult>((resolve, reject) => {
    let settled = false
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port,
        method,
        path,
        agent,
        headers: { Connection: 'keep-alive', ...headers },
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          settled = true
          agent.destroy()
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          })
        })
      }
    )
    req.on('error', (error) => {
      agent.destroy()
      if (!settled) reject(error)
    })
    req.end(body)
  })
}

function validUploadHeaders(bytes: number) {
  return {
    Origin: MANAGE_ORIGIN,
    'Content-Type': 'application/zip',
    'Content-Length': String(bytes),
    'x-klicker-import-upload-capability': 'capability',
  }
}

function json(result: HttpResult) {
  return JSON.parse(result.body) as Record<string, unknown>
}

describe('import/export HTTP routes', () => {
  it('allows only the configured manage origin for upload preflight', async () => {
    const harness = await createHarness()
    const allowed = await request(harness.port, {
      method: 'OPTIONS',
      headers: { Origin: MANAGE_ORIGIN },
    })
    assert.equal(allowed.status, 204)
    assert.equal(allowed.headers['access-control-allow-origin'], MANAGE_ORIGIN)
    assert.equal(allowed.headers['access-control-allow-methods'], 'PUT')

    const denied = await request(harness.port, {
      method: 'OPTIONS',
      headers: { Origin: 'https://attacker.example' },
    })
    assert.equal(denied.status, 403)
    assert.equal(denied.headers['access-control-allow-origin'], undefined)
  })

  it('rejects origin, authentication, MIME, and length before calling upload services', async () => {
    let calls = 0
    const upload: ImportExportRouteServices['uploadPreparedElementImportPackage'] =
      async () => {
        calls += 1
        return { bytes: 3, sha256: 'not-called', replayed: false }
      }

    const authenticated = await createHarness({
      serviceOverrides: { uploadPreparedElementImportPackage: upload },
    })
    const unauthenticated = await createHarness({
      user: null,
      serviceOverrides: { uploadPreparedElementImportPackage: upload },
    })

    const cases = [
      {
        harness: authenticated,
        headers: {
          ...validUploadHeaders(3),
          Origin: 'https://attacker.example',
        },
        status: 403,
        code: ImportExportErrorCode.TOKEN_INVALID,
      },
      {
        harness: unauthenticated,
        headers: validUploadHeaders(3),
        status: 401,
        code: ImportExportErrorCode.TOKEN_INVALID,
      },
      {
        harness: authenticated,
        headers: {
          ...validUploadHeaders(3),
          'Content-Type': 'application/zip; charset=binary',
        },
        status: 415,
        code: ImportExportErrorCode.UNSUPPORTED_FILE_TYPE,
      },
      {
        harness: authenticated,
        headers: { ...validUploadHeaders(3), 'Content-Length': '0' },
        status: 400,
        code: ImportExportErrorCode.INVALID_PACKAGE,
      },
      {
        harness: authenticated,
        headers: { ...validUploadHeaders(3), 'Content-Length': '003' },
        status: 400,
        code: ImportExportErrorCode.INVALID_PACKAGE,
      },
      {
        harness: authenticated,
        headers: {
          ...validUploadHeaders(3),
          'Content-Length': '10485761',
        },
        status: 413,
        code: ImportExportErrorCode.UPLOAD_TOO_LARGE,
      },
    ]

    for (const testCase of cases) {
      const result = await request(testCase.harness.port, {
        headers: testCase.headers,
        body: 'zip',
      })
      assert.equal(result.status, testCase.status)
      assert.equal(json(result).code, testCase.code)
      assert.equal(result.headers.connection, 'close')
    }

    const missingLength = await request(authenticated.port, {
      headers: {
        Origin: MANAGE_ORIGIN,
        'Content-Type': 'application/zip',
        'Transfer-Encoding': 'chunked',
      },
      body: 'zip',
    })
    assert.equal(missingLength.status, 400)
    assert.equal(
      json(missingLength).code,
      ImportExportErrorCode.INVALID_PACKAGE
    )
    assert.equal(calls, 0)
  })

  it('runs feature, capability, and rate-limit service checks without consuming rejected bodies', async () => {
    const expected = [
      [ImportExportErrorCode.DISABLED, 404],
      [ImportExportErrorCode.TOKEN_INVALID, 404],
      [ImportExportErrorCode.RATE_LIMITED, 429],
    ] as const

    for (const [code, status] of expected) {
      let serviceCalls = 0
      const harness = await createHarness({
        serviceOverrides: {
          uploadPreparedElementImportPackage: async () => {
            serviceCalls += 1
            throw new GraphQLError('stable rejection', {
              extensions: { code },
            })
          },
        },
      })
      const result = await request(harness.port, {
        headers: validUploadHeaders(3),
        body: 'zip',
      })

      assert.equal(result.status, status)
      assert.equal(json(result).code, code)
      assert.equal(serviceCalls, 1)
      assert.equal(result.headers.connection, 'close')
      await harness.close()
      activeHarnesses.delete(harness)
    }
  })

  it('returns replay results and closes an unread upload body', async () => {
    const harness = await createHarness({
      serviceOverrides: {
        uploadPreparedElementImportPackage: async () => ({
          bytes: 3,
          sha256: 'replay-sha256',
          replayed: true,
        }),
      },
    })
    const result = await request(harness.port, {
      headers: validUploadHeaders(3),
      body: 'zip',
    })

    assert.equal(result.status, 201)
    assert.deepEqual(json(result), {
      bytes: 3,
      sha256: 'replay-sha256',
      replayed: true,
    })
    assert.equal(result.headers.connection, 'close')
  })

  it('accepts an exact positive upload body and consumes it once', async () => {
    const harness = await createHarness()
    const result = await request(harness.port, {
      headers: validUploadHeaders(3),
      body: 'zip',
    })

    assert.equal(result.status, 201)
    assert.deepEqual(json(result), {
      bytes: 3,
      sha256: 'uploaded-sha256',
      replayed: false,
    })
    assert.equal(result.headers.connection, 'keep-alive')
  })

  it('aborts a trickled upload body at the route deadline', async () => {
    const harness = await createHarness({ uploadBodyTimeoutMs: 30 })
    const agent = new Agent({ keepAlive: true })
    const result = await new Promise<HttpResult>((resolve, reject) => {
      const req = httpRequest(
        {
          host: '127.0.0.1',
          port: harness.port,
          method: 'PUT',
          path: `/api/import-export-packages/${ARTIFACT_ID}/upload`,
          agent,
          headers: {
            ...validUploadHeaders(2),
            Connection: 'keep-alive',
          },
        },
        (res) => {
          const chunks: Buffer[] = []
          res.on('data', (chunk: Buffer) => chunks.push(chunk))
          res.on('end', () => {
            agent.destroy()
            req.destroy()
            resolve({
              status: res.statusCode ?? 0,
              headers: res.headers,
              body: Buffer.concat(chunks).toString('utf8'),
            })
          })
        }
      )
      req.on('error', (error) => {
        if (!req.destroyed) reject(error)
      })
      req.write('z')
    })

    assert.equal(result.status, 408)
    assert.equal(json(result).code, ImportExportErrorCode.INVALID_PACKAGE)
    assert.equal(result.headers.connection, 'close')
  })

  it('settles upload iteration after an early client disconnect', async () => {
    let started!: () => void
    let settled!: () => void
    const uploadStarted = new Promise<void>((resolve) => (started = resolve))
    const uploadSettled = new Promise<void>((resolve) => (settled = resolve))
    const harness = await createHarness({
      serviceOverrides: {
        uploadPreparedElementImportPackage: async ({ stream }) => {
          started()
          try {
            for await (const _chunk of stream) {
              // Wait for the intentionally incomplete request to disconnect.
            }
          } finally {
            settled()
          }
          throw new Error('unexpected complete upload')
        },
      },
    })

    const socket = connect(harness.port, '127.0.0.1')
    await new Promise<void>((resolve) => socket.once('connect', resolve))
    socket.write(
      `PUT /api/import-export-packages/${ARTIFACT_ID}/upload HTTP/1.1\r\n` +
        `Host: 127.0.0.1:${harness.port}\r\n` +
        `Origin: ${MANAGE_ORIGIN}\r\n` +
        'Content-Type: application/zip\r\n' +
        'Content-Length: 10\r\n' +
        'x-klicker-import-upload-capability: capability\r\n' +
        'Connection: close\r\n\r\n' +
        'z'
    )
    await uploadStarted
    socket.destroy()
    await Promise.race([
      uploadSettled,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('upload iterator did not settle')),
          500
        )
      ),
    ])
  })

  it('serves authorized local downloads and committed local media', async () => {
    let downloadArgs: { artifactId: string; capability: string } | undefined
    const harness = await createHarness({
      serviceOverrides: {
        downloadLocalElementExportPackage: async (args) => {
          downloadArgs = args
          return Buffer.from('archive')
        },
        getLocalImportedMediaDownload: async () => ({
          buffer: Buffer.from('image'),
          contentType: 'image/png',
        }),
      },
    })

    const download = await request(harness.port, {
      method: 'GET',
      path: `/api/import-export-packages/${ARTIFACT_ID}/download?capability=download-cap`,
      headers: { Origin: MANAGE_ORIGIN },
    })
    assert.equal(download.status, 200)
    assert.equal(download.headers['content-type'], 'application/zip')
    assert.equal(download.body, 'archive')
    assert.deepEqual(downloadArgs, {
      artifactId: ARTIFACT_ID,
      capability: 'download-cap',
    })

    const media = await request(harness.port, {
      method: 'GET',
      path: '/api/import-export-media/user-1/image.png',
    })
    assert.equal(media.status, 200)
    assert.equal(media.headers['content-type'], 'image/png')
    assert.equal(media.headers['x-content-type-options'], 'nosniff')
    assert.equal(
      media.headers['content-security-policy'],
      "default-src 'none'; sandbox"
    )
    assert.equal(media.body, 'image')
  })
})
