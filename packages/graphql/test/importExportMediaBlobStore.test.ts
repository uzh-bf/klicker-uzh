import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  createImportedMediaHref,
  deleteLocalImportedMediaIfExists,
  isCanonicalImportedMediaTarget,
  parseLocalImportedMediaHref,
  readLocalImportedMedia,
  statLocalImportedMedia,
  writeLocalImportedMediaExclusive,
} from '../src/services/importExportMediaBlobStore.js'

const OWNER_ID = '11111111-1111-4111-8111-111111111111'
const BLOB_NAME = 'imported/22222222-2222-4222-8222-222222222222.png'

describe('local imported-media blob provider', () => {
  let directory: string
  const previousStorage = process.env.IMPORT_EXPORT_PACKAGE_STORAGE
  const previousDirectory = process.env.LOCAL_IMPORT_EXPORT_PACKAGE_DIR
  const previousApiOrigin = process.env.APP_ORIGIN_API

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'klicker-import-media-'))
    process.env.IMPORT_EXPORT_PACKAGE_STORAGE = 'local'
    process.env.LOCAL_IMPORT_EXPORT_PACKAGE_DIR = directory
    process.env.APP_ORIGIN_API = 'http://127.0.0.1:3000'
  })

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  afterAll(() => {
    const restore = (key: string, value: string | undefined) => {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    restore('IMPORT_EXPORT_PACKAGE_STORAGE', previousStorage)
    restore('LOCAL_IMPORT_EXPORT_PACKAGE_DIR', previousDirectory)
    restore('APP_ORIGIN_API', previousApiOrigin)
  })

  it('creates exclusively, verifies exact reads, stats, hrefs, and deletion', async () => {
    const bytes = Buffer.from('local imported media')
    await expect(
      writeLocalImportedMediaExclusive(OWNER_ID, BLOB_NAME, bytes)
    ).resolves.toBe(true)
    await expect(
      writeLocalImportedMediaExclusive(OWNER_ID, BLOB_NAME, bytes)
    ).resolves.toBe(false)
    await expect(readLocalImportedMedia(OWNER_ID, BLOB_NAME)).resolves.toEqual(
      bytes
    )
    await expect(statLocalImportedMedia(OWNER_ID, BLOB_NAME)).resolves.toEqual({
      contentLength: bytes.length,
    })

    const href = createImportedMediaHref(OWNER_ID, BLOB_NAME)
    expect(href).toBe(
      `http://127.0.0.1:3000/api/import-export-media/${OWNER_ID}/22222222-2222-4222-8222-222222222222.png`
    )
    expect(parseLocalImportedMediaHref(href)).toEqual({
      containerName: OWNER_ID,
      blobName: BLOB_NAME,
    })
    await expect(
      deleteLocalImportedMediaIfExists(OWNER_ID, BLOB_NAME)
    ).resolves.toBe(true)
    await expect(
      deleteLocalImportedMediaIfExists(OWNER_ID, BLOB_NAME)
    ).resolves.toBe(false)
  })

  it('rejects traversal, noncanonical owners, targets, and URL suffixes', async () => {
    expect(
      isCanonicalImportedMediaTarget({
        ownerId: OWNER_ID,
        storageContainer: OWNER_ID,
        storageBlob: BLOB_NAME,
      })
    ).toBe(true)
    for (const blobName of [
      '../secret.png',
      'imported/../secret.png',
      'imported/not-a-uuid.png',
      `${BLOB_NAME}/extra`,
      BLOB_NAME.toUpperCase(),
    ]) {
      expect(() => createImportedMediaHref(OWNER_ID, blobName)).toThrow()
    }
    expect(() => createImportedMediaHref('not-a-user', BLOB_NAME)).toThrow()
    expect(
      parseLocalImportedMediaHref(
        `${createImportedMediaHref(OWNER_ID, BLOB_NAME)}?download=1`
      )
    ).toBeNull()
  })
})
