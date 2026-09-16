import {
  ImportExportDomainError,
  ImportExportErrorCode,
} from '../lib/importExportErrors.js'
import {
  collectAnswerCollectionMediaReferences,
  collectElementMediaReferences,
  MediaReferenceKind,
} from '../lib/importExportMediaReferences.js'
import {
  IMPORT_EXPORT_PACKAGE_TYPE,
  IMPORT_EXPORT_PACKAGE_VERSION,
  MAX_IMPORT_EXPORT_JSON_BYTES,
  MAX_IMPORT_EXPORT_PACKAGE_BYTES,
} from '../lib/importExportPackageConfig.js'
import {
  createPackageFilePath,
  manifestSchema,
  packageRefSchema,
} from '../lib/importExportPackageContract.js'
import { createZip } from '../lib/zip.js'
import { parseElementImportPackage } from './elementImportPackageParser.js'
import { resolveKlickerMediaHref } from './mediaStorage.js'
import {
  createPortableExportManifest,
  getStoredZipByteLength,
  type PortableExportPlan,
} from './portableExportPlan.js'

function invalid(): never {
  throw new ImportExportDomainError(ImportExportErrorCode.INVALID_PACKAGE)
}
function jsonFile(path: string, value: unknown) {
  const data = Buffer.from(JSON.stringify(value, null, 2), 'utf8')
  if (data.length > MAX_IMPORT_EXPORT_JSON_BYTES)
    throw new ImportExportDomainError(ImportExportErrorCode.PACKAGE_TOO_LARGE)
  return { path, data, bytes: data.length }
}
/** Public first-party image references are retained; exporting never fetches them. */
export function renderElementJsonPackage(
  plan: PortableExportPlan,
  createdAt: string
) {
  const references = [
    ...plan.elements.flatMap(({ content }) =>
      collectElementMediaReferences(content)
    ),
    ...plan.answerCollections.flatMap(({ content }) =>
      collectAnswerCollectionMediaReferences(content)
    ),
  ]
  if (
    references.some(
      (reference) =>
        reference.kind === MediaReferenceKind.AUTO_LOAD &&
        !resolveKlickerMediaHref(reference.href)
    )
  ) {
    throw new ImportExportDomainError(
      ImportExportErrorCode.ELEMENT_NOT_PORTABLE
    )
  }
  const manifest = createPortableExportManifest({
    plan,
    media: [],
    warnings: [],
    createdAt,
  })
  const files = [
    jsonFile('manifest.json', manifest),
    ...plan.elements.map((element) =>
      jsonFile(element.manifest.file, element.content)
    ),
    ...plan.answerCollections.map((collection) =>
      jsonFile(collection.path, collection.content)
    ),
  ]
  const storedZipBytes = getStoredZipByteLength(files)
  if (storedZipBytes > MAX_IMPORT_EXPORT_PACKAGE_BYTES)
    throw new ImportExportDomainError(
      ImportExportErrorCode.EXPORT_PACKAGE_TOO_LARGE
    )
  return {
    manifest,
    files,
    storedZipBytes,
    warnings: [],
    exceedsPackageLimit: false,
  }
}
function readJson(data: Buffer) {
  if (data.length > MAX_IMPORT_EXPORT_JSON_BYTES)
    throw new ImportExportDomainError(ImportExportErrorCode.PACKAGE_TOO_LARGE)
  try {
    return JSON.parse(
      new TextDecoder('utf-8', { fatal: true })
        .decode(data)
        .replace(/^\uFEFF/, '')
    ) as unknown
  } catch {
    return invalid()
  }
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
/** Multiple loose files travel as one bounded artifact, so receipts bind the complete selection. */
export function parseLooseElementJsonFiles(buffer: Buffer) {
  if (buffer.length > MAX_IMPORT_EXPORT_PACKAGE_BYTES)
    throw new ImportExportDomainError(ImportExportErrorCode.PACKAGE_TOO_LARGE)
  let document: unknown
  try {
    document = JSON.parse(
      new TextDecoder('utf-8', { fatal: true })
        .decode(buffer)
        .replace(/^\uFEFF/, '')
    )
  } catch {
    return invalid()
  }
  const files: Array<{ name: string; content: unknown }> = []
  if (record(document) && document.type === 'klicker-json-files') {
    if (
      document.version !== 1 ||
      Object.keys(document).some(
        (key) => !['type', 'version', 'files'].includes(key)
      ) ||
      !Array.isArray(document.files) ||
      document.files.length === 0 ||
      document.files.length > 151
    )
      return invalid()
    for (const file of document.files) {
      if (
        !record(file) ||
        Object.keys(file).some((key) => !['name', 'content'].includes(key)) ||
        typeof file.name !== 'string' ||
        file.name.length > 255 ||
        !file.name.toLowerCase().endsWith('.json') ||
        typeof file.content !== 'string'
      )
        return invalid()
      files.push({
        name: file.name,
        content: readJson(Buffer.from(file.content, 'utf8')),
      })
    }
  } else {
    if (buffer.length > MAX_IMPORT_EXPORT_JSON_BYTES)
      throw new ImportExportDomainError(ImportExportErrorCode.PACKAGE_TOO_LARGE)
    files.push({ name: 'element.json', content: document })
  }
  const elements: Array<{
    ref: unknown
    file: string
    answerCollectionRef?: unknown
  }> = []
  const answerCollections: Array<{ ref: unknown; file: string }> = []
  const entries: ReturnType<typeof jsonFile>[] = []
  const sourceFiles = new Map<string, string>()
  let manifests = 0
  for (const file of files) {
    const content = file.content
    if (!record(content)) return invalid()
    if (content.type === IMPORT_EXPORT_PACKAGE_TYPE) {
      const manifest = manifestSchema.safeParse(content)
      if (!manifest.success) return invalid()
      if (++manifests > 1 || manifest.data.media.length) return invalid()
      continue
    }
    const isElement = typeof content.type === 'string'
    const ref = packageRefSchema.safeParse(content.ref)
    if (!ref.success) return invalid()
    const path = createPackageFilePath(
      isElement ? 'elements' : 'answer-collections',
      ref.data
    )
    if (isElement)
      elements.push({
        ref: content.ref,
        file: path,
        ...(content.answerCollectionRef === undefined
          ? {}
          : { answerCollectionRef: content.answerCollectionRef }),
      })
    else answerCollections.push({ ref: content.ref, file: path })
    if (elements.length > 100 || answerCollections.length > 50) return invalid()
    entries.push(jsonFile(path, content))
    if (typeof content.ref === 'string') sourceFiles.set(content.ref, file.name)
  }
  const manifest = {
    type: IMPORT_EXPORT_PACKAGE_TYPE,
    version: IMPORT_EXPORT_PACKAGE_VERSION,
    createdAt: new Date(0).toISOString(),
    elements,
    answerCollections,
    media: [],
  }
  const normalized = parseElementImportPackage(
    createZip([jsonFile('manifest.json', manifest), ...entries])
  )
  return { ...normalized, sourceFiles }
}
