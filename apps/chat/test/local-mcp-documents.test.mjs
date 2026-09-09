import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'

import {
  findLocalMcpDocuments,
  loadLocalMcpDocuments,
  toLocalMcpDocumentSource,
} from '../scripts/local-mcp-documents.mjs'

const temporaryDirectories = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

async function documentFile(value) {
  const directory = await mkdtemp(join(tmpdir(), 'local-mcp-documents-'))
  temporaryDirectories.push(directory)
  const filePath = join(directory, 'documents.json')
  await writeFile(filePath, JSON.stringify(value), 'utf8')
  return filePath
}

const fallbackDocuments = [{ title: 'fallback' }]

describe('local MCP document loading', () => {
  test('keeps the existing fallback object when the file variable is unset', () => {
    expect(loadLocalMcpDocuments({}, fallbackDocuments)).toBe(fallbackDocuments)
  })

  test('fails for a configured missing file instead of falling back', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'local-mcp-missing-'))
    temporaryDirectories.push(directory)

    expect(() =>
      loadLocalMcpDocuments(
        { LOCAL_MCP_DOCUMENTS_FILE: join(directory, 'missing.json') },
        fallbackDocuments
      )
    ).toThrow('LOCAL_MCP_DOCUMENTS_FILE')
  })

  test('rejects invalid document configuration', async () => {
    const filePath = await documentFile([
      {
        title: 'Invalid reference type',
        page: 0,
        keywords: ['synthetic'],
        content: 'Fixture content',
        reference: 'sources/invalid.md',
        reference_type: 'video',
      },
    ])

    expect(() =>
      loadLocalMcpDocuments(
        { LOCAL_MCP_DOCUMENTS_FILE: filePath },
        fallbackDocuments
      )
    ).toThrow('Invalid local MCP document')
  })

  test('retrieves keywords case-insensitively and preserves citation provenance', async () => {
    const filePath = await documentFile([
      {
        title: 'Synthetic document exercise',
        page: 7,
        keywords: ['ExampleTool', 'S3'],
        content: 'Synthetic embedded content',
        reference: 'sources/example-exercise.md',
        reference_type: 'md',
      },
    ])
    const documents = loadLocalMcpDocuments({
      LOCAL_MCP_DOCUMENTS_FILE: filePath,
    })
    const matches = findLocalMcpDocuments(
      documents,
      'please explain exampletool'
    )

    expect(matches).toHaveLength(1)
    expect(toLocalMcpDocumentSource(matches[0])).toEqual({
      reference: 'sources/example-exercise.md',
      reference_type: 'md',
      source_type: 'document',
      title: 'Synthetic document exercise',
      chunks: [
        {
          content: 'Synthetic embedded content',
          page_number: 7,
        },
      ],
    })
  })
})
