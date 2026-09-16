import {
  type ParsedElementSpreadsheet,
  parseElementSpreadsheetTables,
} from '../lib/elementSpreadsheetDomain.js'
import {
  loadElementWorkbook,
  readKlickerWorkbook,
} from '../lib/elementSpreadsheetWorkbook.js'
import {
  ImportExportDomainError,
  ImportExportErrorCode,
} from '../lib/importExportErrors.js'
import {
  collectAnswerCollectionMediaReferences,
  collectElementMediaReferences,
  MediaReferenceKind,
} from '../lib/importExportMediaReferences.js'
import { parseZip } from '../lib/zip.js'
import { parseElementImportPackage } from './elementImportPackageParser.js'
import { parseLooseElementJsonFiles } from './elementJsonFiles.js'
import { resolveKlickerMediaHref } from './mediaStorage.js'

/** All formats enter the same private-copy, duplicate and durable-receipt path. */
export async function parseElementImportFile(
  buffer: Buffer
): Promise<ParsedElementSpreadsheet> {
  let parsed: ParsedElementSpreadsheet
  const zipped = buffer[0] === 0x50 && buffer[1] === 0x4b
  const entries = zipped
    ? parseZip(buffer, {
        maxEntries: 251,
        maxUncompressedBytes: 20 * 1024 * 1024,
        allowDirectories: true,
        allowDataDescriptors: true,
      })
    : null
  if (entries?.some((entry) => entry.path === '[Content_Types].xml')) {
    const read = readKlickerWorkbook(await loadElementWorkbook(buffer))
    parsed = parseElementSpreadsheetTables(read.tables, read.issues)
  } else {
    const json = zipped
      ? {
          ...parseElementImportPackage(buffer),
          sourceFiles: new Map<string, string>(),
        }
      : parseLooseElementJsonFiles(buffer)
    if (json.media.length)
      throw new ImportExportDomainError(ImportExportErrorCode.INVALID_PACKAGE)
    parsed = {
      elements: json.elements,
      answerCollections: json.answerCollections,
      issues: [],
      sources: json.elements.map((element) => ({
        ref: element.ref,
        name: element.name,
        row: 0,
        sheet:
          json.sourceFiles.get(element.ref) ??
          json.manifest.elements.find((entry) => entry.ref === element.ref)!
            .file,
      })),
    }
  }
  const invalid = new Set<string>()
  const invalidCollections = new Set<string>()
  for (const collection of parsed.answerCollections) {
    if (
      collectAnswerCollectionMediaReferences(collection).some(
        (reference) =>
          reference.kind === MediaReferenceKind.AUTO_LOAD &&
          !resolveKlickerMediaHref(reference.href)
      )
    )
      invalidCollections.add(collection.ref)
  }
  for (const element of parsed.elements) {
    const source = parsed.sources.find((source) => source.ref === element.ref)!
    if (
      element.answerCollectionRef &&
      invalidCollections.has(element.answerCollectionRef)
    ) {
      invalid.add(element.ref)
      parsed.issues.push({
        ...source,
        field: 'answerCollectionRef',
        code: 'INVALID_IMAGE_URL',
      })
    }
    const collection = parsed.answerCollections.find(
      (entry) => entry.ref === element.answerCollectionRef
    )
    const references = [
      ...collectElementMediaReferences(element),
      ...(collection ? collectAnswerCollectionMediaReferences(collection) : []),
    ]
    for (const reference of references) {
      if (reference.kind !== MediaReferenceKind.AUTO_LOAD) continue
      if (!resolveKlickerMediaHref(reference.href)) {
        invalid.add(element.ref)
        parsed.issues.push({
          ...source,
          field: 'image',
          code: 'INVALID_IMAGE_URL',
        })
      } else
        parsed.issues.push({
          ...source,
          field: 'image',
          code: 'SOURCE_IMAGE_DEPENDENCY',
        })
    }
  }
  return {
    ...parsed,
    elements: parsed.elements.filter((element) => !invalid.has(element.ref)),
    answerCollections: parsed.answerCollections.filter(
      (collection) => !invalidCollections.has(collection.ref)
    ),
  }
}
