import { readFileSync } from 'node:fs'

const DOCUMENTS_ENV_NAME = 'LOCAL_MCP_DOCUMENTS_FILE'
const MAX_FILE_BYTES = 2 * 1024 * 1024
const MAX_DOCUMENTS = 100
const MAX_KEYWORDS = 64
const MAX_TITLE_LENGTH = 200
const MAX_KEYWORD_LENGTH = 200
const MAX_CONTENT_LENGTH = 100_000
const MAX_REFERENCE_LENGTH = 2_048
const MAX_PAGE = 100_000

// These are document reference labels understood as document citations by the
// source normalizer. Media and link-only labels are intentionally excluded.
const KNOWN_DOCUMENT_REFERENCE_TYPES = new Set([
  'md',
  'markdown',
  'pdf',
  'txt',
  'text',
  'doc',
  'docx',
  'html',
  'htm',
])

const DEFAULT_REFERENCE = 'synthetic-course-material.pdf'
const DEFAULT_REFERENCE_TYPE = 'pdf'

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function requiredString(value, field, maxLength) {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > maxLength
  ) {
    throw new Error(`Invalid local MCP document ${field}`)
  }
  return value
}

function validateDocument(value, index) {
  if (!isRecord(value)) {
    throw new Error(`Invalid local MCP document at index ${index}`)
  }

  const title = requiredString(value.title, 'title', MAX_TITLE_LENGTH)
  const content = requiredString(value.content, 'content', MAX_CONTENT_LENGTH)
  const reference = requiredString(
    value.reference,
    'reference',
    MAX_REFERENCE_LENGTH
  )
  const referenceType = requiredString(
    value.reference_type,
    'reference_type',
    32
  ).toLowerCase()

  if (!KNOWN_DOCUMENT_REFERENCE_TYPES.has(referenceType)) {
    throw new Error(
      `Invalid local MCP document reference_type at index ${index}`
    )
  }
  if (
    !Number.isInteger(value.page) ||
    value.page < 1 ||
    value.page > MAX_PAGE
  ) {
    throw new Error(`Invalid local MCP document page at index ${index}`)
  }
  if (
    !Array.isArray(value.keywords) ||
    value.keywords.length === 0 ||
    value.keywords.length > MAX_KEYWORDS ||
    value.keywords.some(
      (keyword) =>
        typeof keyword !== 'string' ||
        keyword.trim().length === 0 ||
        keyword.length > MAX_KEYWORD_LENGTH
    )
  ) {
    throw new Error(`Invalid local MCP document keywords at index ${index}`)
  }

  return {
    title,
    page: value.page,
    keywords: value.keywords,
    content,
    reference,
    reference_type: referenceType,
  }
}

function parseDocumentsFile(filePath) {
  let raw
  try {
    raw = readFileSync(filePath)
  } catch {
    throw new Error('LOCAL_MCP_DOCUMENTS_FILE could not be read')
  }

  if (raw.byteLength > MAX_FILE_BYTES) {
    throw new Error('LOCAL_MCP_DOCUMENTS_FILE is too large')
  }

  let parsed
  try {
    parsed = JSON.parse(raw.toString('utf8'))
  } catch {
    throw new Error('LOCAL_MCP_DOCUMENTS_FILE is not valid JSON')
  }

  if (
    !Array.isArray(parsed) ||
    parsed.length === 0 ||
    parsed.length > MAX_DOCUMENTS
  ) {
    throw new Error(
      'LOCAL_MCP_DOCUMENTS_FILE must contain a bounded document array'
    )
  }

  return parsed.map(validateDocument)
}

export function loadLocalMcpDocuments(env, fallbackDocuments) {
  const configuredPath = env[DOCUMENTS_ENV_NAME]
  if (configuredPath === undefined) return fallbackDocuments
  if (
    typeof configuredPath !== 'string' ||
    configuredPath.trim().length === 0
  ) {
    throw new Error('LOCAL_MCP_DOCUMENTS_FILE must be a non-empty path')
  }
  return parseDocumentsFile(configuredPath)
}

export function findLocalMcpDocuments(documents, query) {
  const normalizedQuery = query.toLowerCase()
  return documents.filter((document) =>
    document.keywords.some((keyword) =>
      normalizedQuery.includes(keyword.toLowerCase())
    )
  )
}

export function toLocalMcpDocumentSource(document) {
  return {
    reference: document.reference ?? DEFAULT_REFERENCE,
    reference_type: document.reference_type ?? DEFAULT_REFERENCE_TYPE,
    source_type: 'document',
    title: document.title,
    chunks: [
      {
        content: document.content,
        page_number: document.page,
      },
    ],
  }
}
