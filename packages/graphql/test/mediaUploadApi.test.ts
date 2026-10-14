import { createRequire } from 'node:module'
import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Context } from '../src/lib/context.js'

const uploads = vi.hoisted(() => ({ neutral: vi.fn(), legacy: vi.fn() }))
vi.mock('../src/services/mediaStorage/index.js', () => ({
  createMediaStorage: () => ({ createUpload: uploads.neutral }),
}))
vi.mock('../src/services/mediaStorage/azure.js', () => ({
  AzureMediaStorage: class {
    createUpload = uploads.legacy
  },
}))

import { schema } from '../src/index.js'

// Pothos uses GraphQL's CommonJS classes. Resolve the executor in the same
// realm under both the focused config and the full integration suite.
const { graphql } = createRequire(import.meta.url)(
  'graphql'
) as typeof import('graphql')

const ownerId = '11111111-1111-4111-8111-111111111111'
const descriptor = {
  uploadUrl: 'https://objects.example.test/key?synthetic-signature',
  uploadHref: 'https://media.example.test/key',
  uploadHeaders: [{ name: 'Content-Type', value: 'image/png' }],
  uploadSasURL: 'https://synthetic.blob.core.windows.net?synthetic-signature',
  containerName: ownerId,
  fileName: '22222222-2222-4222-8222-222222222222.png',
}
const source =
  'mutation { requestMediaUpload(fileName: "image.png", contentType: "image/png") { uploadUrl uploadHref uploadHeaders { name value } } }'

function context(
  user: Context['user'] = {
    sub: ownerId,
    role: UserRole.USER,
    scope: UserLoginScope.FULL_ACCESS,
    catalystIndividual: false,
    catalystInstitutional: false,
  }
) {
  const create = vi.fn().mockResolvedValue({})
  return {
    ctx: {
      user,
      prisma: {
        mediaFile: { create },
        participant: { findUnique: vi.fn().mockResolvedValue(null) },
      },
    } as unknown as Context,
    create,
  }
}

beforeEach(() => {
  uploads.neutral.mockReset().mockResolvedValue(descriptor)
  uploads.legacy.mockReset().mockResolvedValue(descriptor)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('public media API boundary', () => {
  it('allows full-access lecturers and persists only a durable href in their own namespace', async () => {
    const { ctx, create } = context()
    const result = await graphql({ schema, source, contextValue: ctx })
    expect(result.errors).toBeUndefined()
    expect(result.data?.requestMediaUpload).toEqual({
      uploadUrl: descriptor.uploadUrl,
      uploadHref: descriptor.uploadHref,
      uploadHeaders: descriptor.uploadHeaders,
    })
    expect(uploads.neutral).toHaveBeenCalledWith({
      ownerId,
      fileName: expect.stringMatching(/^[0-9a-f-]{36}\.png$/),
      contentType: 'image/png',
    })
    expect(create).toHaveBeenCalledWith({
      data: {
        id: expect.any(String),
        ownerId,
        type: 'image/png',
        name: 'image.png',
        href: descriptor.uploadHref,
      },
    })
    expect(JSON.stringify(create.mock.calls)).not.toContain(
      'synthetic-signature'
    )
    expect(uploads.legacy).not.toHaveBeenCalled()
  })

  it.each([
    'anonymous',
    'read-only',
    'session-exec',
    'otp',
    'participant',
  ] as const)('denies %s before issuing an upload or writing media', async (actor) => {
    const { ctx, create } = context()
    if (actor === 'anonymous') delete ctx.user
    else if (actor === 'participant') ctx.user!.role = UserRole.PARTICIPANT
    else
      ctx.user!.scope = {
        'read-only': UserLoginScope.READ_ONLY,
        'session-exec': UserLoginScope.SESSION_EXEC,
        otp: UserLoginScope.OTP,
      }[actor]
    const result = await graphql({ schema, source, contextValue: ctx })
    expect(result.errors?.length).toBeGreaterThan(0)
    expect(uploads.neutral).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  it('rejects invalid image types and client-supplied owner namespaces', async () => {
    const { ctx, create } = context()
    for (const contentType of ['text/html', 'constructor', '__proto__']) {
      const badType = await graphql({
        schema,
        source: source.replace('image/png', contentType),
        contextValue: ctx,
      })
      expect(badType.errors?.[0]?.extensions.code).toBe('MEDIA_FILE_INVALID')
    }
    const foreignOwner = await graphql({
      schema,
      source: source.replace('fileName:', 'ownerId: "foreign", fileName:'),
      contextValue: ctx,
    })
    expect(foreignOwner.errors?.length).toBeGreaterThan(0)
    expect(uploads.neutral).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  it.each([
    '',
    'x'.repeat(513),
  ])('rejects invalid display filenames before storage or persistence', async (fileName) => {
    const { ctx, create } = context()
    const result = await graphql({
      schema,
      source: source.replace('image.png', fileName),
      contextValue: ctx,
    })
    expect(result.errors?.[0]?.extensions.code).toBe('MEDIA_FILE_INVALID')
    expect(uploads.neutral).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  it('does not create a row when the storage reservation fails', async () => {
    uploads.neutral.mockRejectedValueOnce(
      new Error('Synthetic storage failure')
    )
    const { ctx, create } = context()
    const result = await graphql({ schema, source, contextValue: ctx })
    expect(result.errors?.length).toBeGreaterThan(0)
    expect(create).not.toHaveBeenCalled()
  })

  it('retains the old Azure response shape and uses only its adapter', async () => {
    vi.stubEnv('MEDIA_STORAGE_PROVIDER', 's3')
    const { ctx } = context()
    const result = await graphql({
      schema,
      source:
        'mutation { getFileUploadSas(fileName: "image.png", contentType: "image/png") { uploadSasURL uploadHref containerName fileName } }',
      contextValue: ctx,
    })
    expect(result.errors).toBeUndefined()
    expect(result.data?.getFileUploadSas).toEqual({
      uploadSasURL: descriptor.uploadSasURL,
      uploadHref: descriptor.uploadHref,
      containerName: ownerId,
      fileName: descriptor.fileName,
    })
    expect(uploads.legacy).toHaveBeenCalledOnce()
    expect(uploads.neutral).not.toHaveBeenCalled()
  })
})
