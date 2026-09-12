import { createHmac, randomUUID } from 'node:crypto'
import {
  createImportExportArtifactStorageTarget,
  createImportUploadCapability,
  createLocalArtifactDownloadCapability,
  IMPORT_EXPORT_CAPABILITY_CLOCK_SKEW_MS,
  IMPORT_EXPORT_CAPABILITY_MAX_TTL_MS,
  IMPORT_EXPORT_PACKAGE_CONTAINER,
  ImportExportCapabilityPurpose,
  isCanonicalImportExportArtifactId,
  isCanonicalImportExportArtifactStorageTarget,
  verifyImportUploadCapability,
  verifyLocalArtifactDownloadCapability,
} from '../src/lib/importExportCapabilities.js'
import { MAX_IMPORT_EXPORT_PACKAGE_BYTES } from '../src/lib/importExportPackageConfig.js'

const SIGNING_DOMAIN = 'klicker-element-package-capability'
const SECRET = 'test-import-export-capability-secret'
const ROTATED_SECRET = 'rotated-import-export-capability-secret'
const NOW = new Date('2026-07-12T12:00:00.000Z').getTime()

function signRawPayload(
  serializedPayload: string,
  purpose: ImportExportCapabilityPurpose,
  secret = SECRET
) {
  const encodedPayload = Buffer.from(serializedPayload, 'utf8').toString(
    'base64url'
  )
  const signature = createHmac('sha256', secret)
    .update(`${SIGNING_DOMAIN}\0${purpose}\0${encodedPayload}`)
    .digest('base64url')
  return `${encodedPayload}.${signature}`
}

describe('import/export signed capabilities', () => {
  const userId = randomUUID()
  const otherUserId = randomUUID()
  const artifactId = randomUUID()
  const otherArtifactId = randomUUID()
  const bytes = 1024
  const expiresAt = NOW + IMPORT_EXPORT_CAPABILITY_MAX_TTL_MS

  it('creates and verifies an exact, bounded import upload capability', () => {
    const expectedPayload = {
      v: 1,
      purpose: ImportExportCapabilityPurpose.IMPORT_UPLOAD,
      userId,
      artifactId,
      bytes,
      issuedAt: NOW,
      expiresAt,
    }
    const token = createImportUploadCapability({
      secret: SECRET,
      userId,
      artifactId,
      bytes,
      issuedAt: NOW,
      expiresAt,
    })

    // Preserve the established byte-level format across codec refactors.
    expect(token).toBe(
      signRawPayload(
        JSON.stringify(expectedPayload),
        ImportExportCapabilityPurpose.IMPORT_UPLOAD
      )
    )
    expect(
      verifyImportUploadCapability({
        token,
        secret: SECRET,
        userId,
        artifactId,
        bytes,
        now: NOW,
      })
    ).toEqual(expectedPayload)
  })

  it('binds upload capabilities to purpose, user, artifact, exact bytes, and secret', () => {
    const token = createImportUploadCapability({
      secret: SECRET,
      userId,
      artifactId,
      bytes,
      issuedAt: NOW,
      expiresAt,
    })
    const expected = {
      token,
      secret: SECRET,
      userId,
      artifactId,
      bytes,
      now: NOW,
    }

    expect(
      verifyImportUploadCapability({ ...expected, userId: otherUserId })
    ).toBeNull()
    expect(
      verifyImportUploadCapability({ ...expected, artifactId: otherArtifactId })
    ).toBeNull()
    expect(
      verifyImportUploadCapability({ ...expected, bytes: bytes + 1 })
    ).toBeNull()
    expect(
      verifyImportUploadCapability({ ...expected, secret: ROTATED_SECRET })
    ).toBeNull()
    expect(
      verifyLocalArtifactDownloadCapability({
        token,
        secret: SECRET,
        userId,
        artifactId,
        now: NOW,
      })
    ).toBeNull()
  })

  it('binds local download capabilities separately from uploads', () => {
    const expectedPayload = {
      v: 1,
      purpose: ImportExportCapabilityPurpose.LOCAL_ARTIFACT_DOWNLOAD,
      userId,
      artifactId,
      issuedAt: NOW,
      expiresAt,
    }
    const token = createLocalArtifactDownloadCapability({
      secret: SECRET,
      userId,
      artifactId,
      issuedAt: NOW,
      expiresAt,
    })

    expect(token).toBe(
      signRawPayload(
        JSON.stringify(expectedPayload),
        ImportExportCapabilityPurpose.LOCAL_ARTIFACT_DOWNLOAD
      )
    )
    expect(
      verifyLocalArtifactDownloadCapability({
        token,
        secret: SECRET,
        userId,
        artifactId,
        now: NOW,
      })
    ).toEqual(expectedPayload)
    expect(
      verifyLocalArtifactDownloadCapability({
        token,
        secret: SECRET,
        userId: otherUserId,
        artifactId,
        now: NOW,
      })
    ).toBeNull()
    expect(
      verifyLocalArtifactDownloadCapability({
        token,
        secret: SECRET,
        userId,
        artifactId: otherArtifactId,
        now: NOW,
      })
    ).toBeNull()
    expect(
      verifyImportUploadCapability({
        token,
        secret: SECRET,
        userId,
        artifactId,
        bytes,
        now: NOW,
      })
    ).toBeNull()
  })

  it('rejects tampering and short or long signatures without throwing', () => {
    const token = createImportUploadCapability({
      secret: SECRET,
      userId,
      artifactId,
      bytes,
      issuedAt: NOW,
      expiresAt,
    })
    const separator = token.indexOf('.')
    const encodedPayload = token.slice(0, separator)
    const signature = token.slice(separator + 1)
    const tamperedPayload = `${encodedPayload.slice(0, -1)}${
      encodedPayload.endsWith('A') ? 'B' : 'A'
    }`
    const invalidTokens = [
      `${tamperedPayload}.${signature}`,
      `${encodedPayload}.${signature.slice(1)}`,
      `${encodedPayload}.${signature}A`,
      `${encodedPayload}.${'A'.repeat(128)}`,
    ]

    for (const invalidToken of invalidTokens) {
      expect(() =>
        verifyImportUploadCapability({
          token: invalidToken,
          secret: SECRET,
          userId,
          artifactId,
          bytes,
          now: NOW,
        })
      ).not.toThrow()
      expect(
        verifyImportUploadCapability({
          token: invalidToken,
          secret: SECRET,
          userId,
          artifactId,
          bytes,
          now: NOW,
        })
      ).toBeNull()
    }
  })

  it('rejects malformed token framing and noncanonical base64url', () => {
    const token = createImportUploadCapability({
      secret: SECRET,
      userId,
      artifactId,
      bytes,
      issuedAt: NOW,
      expiresAt,
    })
    const separator = token.indexOf('.')
    const encodedPayload = token.slice(0, separator)
    const signature = token.slice(separator + 1)
    const invalidTokens = [
      '',
      '.',
      token.replace('.', '..'),
      `${encodedPayload}=.${signature}`,
      `${encodedPayload}.${signature}=`,
      `${encodedPayload}.${signature}!`,
      `${'A'.repeat(2049)}.${signature}`,
    ]

    for (const invalidToken of invalidTokens) {
      expect(
        verifyImportUploadCapability({
          token: invalidToken,
          secret: SECRET,
          userId,
          artifactId,
          bytes,
          now: NOW,
        })
      ).toBeNull()
    }
  })

  it('accepts only the canonical closed upload payload representation', () => {
    const canonicalFields = {
      v: 1,
      purpose: ImportExportCapabilityPurpose.IMPORT_UPLOAD,
      userId,
      artifactId,
      bytes,
      issuedAt: NOW,
      expiresAt,
    }
    const malformedPayloads = [
      'not-json',
      '{}',
      JSON.stringify({ ...canonicalFields, extra: true }),
      JSON.stringify({
        purpose: canonicalFields.purpose,
        v: canonicalFields.v,
        userId: canonicalFields.userId,
        artifactId: canonicalFields.artifactId,
        bytes: canonicalFields.bytes,
        issuedAt: canonicalFields.issuedAt,
        expiresAt: canonicalFields.expiresAt,
      }),
      `{"v":1,"v":1,"purpose":"IMPORT_UPLOAD","userId":"${userId}","artifactId":"${artifactId}","bytes":${bytes},"issuedAt":${NOW},"expiresAt":${expiresAt}}`,
      ` ${JSON.stringify(canonicalFields)}`,
      JSON.stringify({ ...canonicalFields, v: 2 }),
      JSON.stringify({ ...canonicalFields, bytes: String(bytes) }),
      JSON.stringify({ ...canonicalFields, issuedAt: String(NOW) }),
      JSON.stringify({ ...canonicalFields, userId: userId.toUpperCase() }),
    ]

    for (const serializedPayload of malformedPayloads) {
      const token = signRawPayload(
        serializedPayload,
        ImportExportCapabilityPurpose.IMPORT_UPLOAD
      )
      expect(
        verifyImportUploadCapability({
          token,
          secret: SECRET,
          userId,
          artifactId,
          bytes,
          now: NOW,
        })
      ).toBeNull()
    }
  })

  it('enforces expiry, not-before skew, and the hard maximum TTL', () => {
    const token = createImportUploadCapability({
      secret: SECRET,
      userId,
      artifactId,
      bytes,
      issuedAt: NOW,
      expiresAt,
    })

    expect(
      verifyImportUploadCapability({
        token,
        secret: SECRET,
        userId,
        artifactId,
        bytes,
        now: expiresAt + IMPORT_EXPORT_CAPABILITY_CLOCK_SKEW_MS,
      })
    ).not.toBeNull()
    expect(
      verifyImportUploadCapability({
        token,
        secret: SECRET,
        userId,
        artifactId,
        bytes,
        now: expiresAt + IMPORT_EXPORT_CAPABILITY_CLOCK_SKEW_MS + 1,
      })
    ).toBeNull()
    expect(
      verifyImportUploadCapability({
        token,
        secret: SECRET,
        userId,
        artifactId,
        bytes,
        now: NOW - IMPORT_EXPORT_CAPABILITY_CLOCK_SKEW_MS,
      })
    ).not.toBeNull()
    expect(
      verifyImportUploadCapability({
        token,
        secret: SECRET,
        userId,
        artifactId,
        bytes,
        now: NOW - IMPORT_EXPORT_CAPABILITY_CLOCK_SKEW_MS - 1,
      })
    ).toBeNull()

    expect(() =>
      createImportUploadCapability({
        secret: SECRET,
        userId,
        artifactId,
        bytes,
        issuedAt: NOW,
        expiresAt: expiresAt + 1,
      })
    ).toThrow(/validity period/)

    const overlongPayload = JSON.stringify({
      v: 1,
      purpose: ImportExportCapabilityPurpose.IMPORT_UPLOAD,
      userId,
      artifactId,
      bytes,
      issuedAt: NOW,
      expiresAt: expiresAt + 1,
    })
    expect(
      verifyImportUploadCapability({
        token: signRawPayload(
          overlongPayload,
          ImportExportCapabilityPurpose.IMPORT_UPLOAD
        ),
        secret: SECRET,
        userId,
        artifactId,
        bytes,
        now: NOW,
      })
    ).toBeNull()
  })

  it('validates UUIDs, byte bounds, and secrets before signing', () => {
    const maximumSizeToken = createImportUploadCapability({
      secret: SECRET,
      userId,
      artifactId,
      bytes: MAX_IMPORT_EXPORT_PACKAGE_BYTES,
      issuedAt: NOW,
      expiresAt,
    })
    expect(
      verifyImportUploadCapability({
        token: maximumSizeToken,
        secret: SECRET,
        userId,
        artifactId,
        bytes: MAX_IMPORT_EXPORT_PACKAGE_BYTES,
        now: NOW,
      })
    ).not.toBeNull()

    for (const invalidBytes of [
      0,
      -1,
      1.5,
      MAX_IMPORT_EXPORT_PACKAGE_BYTES + 1,
    ]) {
      expect(() =>
        createImportUploadCapability({
          secret: SECRET,
          userId,
          artifactId,
          bytes: invalidBytes,
          issuedAt: NOW,
          expiresAt,
        })
      ).toThrow(/identity/)
    }

    expect(() =>
      createImportUploadCapability({
        secret: '',
        userId,
        artifactId,
        bytes,
        issuedAt: NOW,
        expiresAt,
      })
    ).toThrow(/configuration/)
    expect(
      verifyImportUploadCapability({
        token: maximumSizeToken,
        secret: '',
        userId,
        artifactId,
        bytes: MAX_IMPORT_EXPORT_PACKAGE_BYTES,
        now: NOW,
      })
    ).toBeNull()
    expect(() =>
      createLocalArtifactDownloadCapability({
        secret: SECRET,
        userId: 'not-a-uuid',
        artifactId,
        issuedAt: NOW,
        expiresAt,
      })
    ).toThrow(/identity/)
  })
})

describe('canonical import/export artifact storage targets', () => {
  it('accepts only canonical artifact UUIDs', () => {
    const id = randomUUID()
    expect(isCanonicalImportExportArtifactId(id)).toBe(true)
    expect(isCanonicalImportExportArtifactId(id.toUpperCase())).toBe(false)
    expect(isCanonicalImportExportArtifactId('../artifact')).toBe(false)
  })

  const ownerId = randomUUID()
  const otherOwnerId = randomUUID()
  const artifactId = randomUUID()
  const otherArtifactId = randomUUID()

  it('generates server-owned import and export targets without accepting a path', () => {
    const importTarget = createImportExportArtifactStorageTarget({
      direction: 'IMPORT',
      ownerId,
      artifactId,
      storageBlob: '../../caller-path.zip',
    } as any)
    const exportTarget = createImportExportArtifactStorageTarget({
      direction: 'EXPORT',
      ownerId,
      artifactId,
    })

    expect(importTarget).toEqual({
      storageContainer: IMPORT_EXPORT_PACKAGE_CONTAINER,
      storageBlob: `imports/${ownerId}/${artifactId}.zip`,
    })
    expect(exportTarget.storageBlob).toBe(
      `exports/${ownerId}/${artifactId}.zip`
    )
    expect(
      isCanonicalImportExportArtifactStorageTarget({
        ...importTarget,
        direction: 'IMPORT',
        ownerId,
        artifactId,
      })
    ).toBe(true)
    expect(
      isCanonicalImportExportArtifactStorageTarget({
        ...exportTarget,
        direction: 'EXPORT',
        ownerId,
        artifactId,
      })
    ).toBe(true)
  })

  it('rejects traversal, encoded separators, empty/dot segments, and backslashes', () => {
    const prefix = `imports/${ownerId}`
    const invalidBlobs = [
      `../${artifactId}.zip`,
      `${prefix}/../${artifactId}.zip`,
      `${prefix}/./${artifactId}.zip`,
      `${prefix}//${artifactId}.zip`,
      `${prefix}\\${artifactId}.zip`,
      `imports%2F${ownerId}%2F${artifactId}.zip`,
      `imports%2f${ownerId}%2f${artifactId}.zip`,
      `imports%5C${ownerId}%5C${artifactId}.zip`,
      `imports%252F${ownerId}%252F${artifactId}.zip`,
      `${prefix}/${artifactId}.zip?download=1`,
      `${prefix}/${artifactId}.zip#fragment`,
      `${prefix}/${artifactId}.zip\0suffix`,
    ]

    for (const storageBlob of invalidBlobs) {
      expect(
        isCanonicalImportExportArtifactStorageTarget({
          storageContainer: IMPORT_EXPORT_PACKAGE_CONTAINER,
          storageBlob,
          direction: 'IMPORT',
          ownerId,
          artifactId,
        })
      ).toBe(false)
    }
  })

  it('rejects noncanonical names and owner, direction, or artifact mismatches', () => {
    const target = createImportExportArtifactStorageTarget({
      direction: 'IMPORT',
      ownerId,
      artifactId,
    })
    const invalidTargets = [
      { ...target, storageContainer: `${IMPORT_EXPORT_PACKAGE_CONTAINER}/` },
      {
        ...target,
        storageContainer: IMPORT_EXPORT_PACKAGE_CONTAINER.toUpperCase(),
      },
      { ...target, storageBlob: target.storageBlob.toUpperCase() },
      { ...target, storageBlob: target.storageBlob.replace('.zip', '.ZIP') },
    ]

    for (const invalidTarget of invalidTargets) {
      expect(
        isCanonicalImportExportArtifactStorageTarget({
          ...invalidTarget,
          direction: 'IMPORT',
          ownerId,
          artifactId,
        })
      ).toBe(false)
    }

    expect(
      isCanonicalImportExportArtifactStorageTarget({
        ...target,
        direction: 'EXPORT',
        ownerId,
        artifactId,
      })
    ).toBe(false)
    expect(
      isCanonicalImportExportArtifactStorageTarget({
        ...target,
        direction: 'IMPORT',
        ownerId: otherOwnerId,
        artifactId,
      })
    ).toBe(false)
    expect(
      isCanonicalImportExportArtifactStorageTarget({
        ...target,
        direction: 'IMPORT',
        ownerId,
        artifactId: otherArtifactId,
      })
    ).toBe(false)
  })
})
