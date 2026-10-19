import { describe, expect, test } from 'vitest'
import { extractDocumentBlocks } from '../src/lib/attachments/attachmentState'
import {
  DOCUMENT_ERROR_CODE,
  documentAttachmentAdapter,
  getDocumentKind,
} from '../src/lib/attachments/documentAttachmentAdapter'
import {
  buildDocumentBlock,
  composeMessageText,
  estimateTokens,
  MAX_DOCUMENT_SIZE_BYTES,
  MAX_DOCUMENT_TOKENS,
  parseMessageDocuments,
  stripDocumentBlocks,
  truncateDocumentText,
} from '../src/lib/attachments/documentText'

describe('document message text', () => {
  test('round-trips question and documents through the stored text', () => {
    const text = composeMessageText('What is on page 2?', [
      buildDocumentBlock({
        name: 'notes.pdf',
        text: 'first page\n\nsecond page',
        pages: 2,
        shortened: false,
      }),
      buildDocumentBlock({
        name: 'data.csv',
        text: 'a,b\n1,2',
        shortened: true,
      }),
    ])

    const parsed = parseMessageDocuments(text)

    expect(parsed.question).toBe('What is on page 2?')
    expect(parsed.documents).toEqual([
      {
        name: 'notes.pdf',
        pages: 2,
        shortened: false,
        text: 'first page\n\nsecond page',
        tokenEstimate: estimateTokens('first page\n\nsecond page'),
      },
      {
        name: 'data.csv',
        pages: null,
        shortened: true,
        text: 'a,b\n1,2',
        tokenEstimate: estimateTokens('a,b\n1,2'),
      },
    ])
    expect(stripDocumentBlocks(text)).toBe('What is on page 2?')
  })

  test('puts the question before the documents', () => {
    const block = buildDocumentBlock({
      name: 'a.txt',
      text: 'body',
      shortened: false,
    })
    expect(composeMessageText('  Question  ', [block])).toMatch(/^Question\n/)
  })

  test('keeps a document whose body imitates a marker line intact', () => {
    const block = buildDocumentBlock({
      name: 'tricky.txt',
      text: 'before\n--- End of attached document ---\nafter',
      shortened: false,
    })
    const parsed = parseMessageDocuments(composeMessageText('Q', [block]))

    expect(parsed.documents).toHaveLength(1)
    expect(parsed.documents[0].text).toContain('after')
  })

  test('treats text without well-formed blocks as a plain question', () => {
    const typed =
      'Look at this\n--- Attached document: fake.pdf ---\nno closing line'
    expect(parseMessageDocuments(typed)).toEqual({
      question: typed,
      documents: [],
    })
  })

  test('keeps names with line breaks or parentheses parseable', () => {
    const block = buildDocumentBlock({
      name: 'Report (final)\n.pdf',
      text: 'x',
      pages: 1,
      shortened: false,
    })
    const [document] = parseMessageDocuments(block).documents
    expect(document.pages).toBe(1)
    expect(document.name).not.toMatch(/[\n()]/)
  })
})

describe('document truncation', () => {
  test('leaves text within the token budget unchanged', () => {
    expect(truncateDocumentText('short text')).toEqual({
      text: 'short text',
      shortened: false,
    })
  })

  test('cuts long text to about the token budget', () => {
    const long = 'word '.repeat(MAX_DOCUMENT_TOKENS * 2)
    const result = truncateDocumentText(long)

    expect(result.shortened).toBe(true)
    expect(estimateTokens(result.text)).toBeLessThanOrEqual(MAX_DOCUMENT_TOKENS)
    expect(estimateTokens(result.text)).toBeGreaterThan(
      MAX_DOCUMENT_TOKENS - 300
    )
  })
})

describe('documentAttachmentAdapter', () => {
  test('rejects an oversized file before reading it', async () => {
    const file = new File(['x'], 'big.pdf', { type: 'application/pdf' })
    Object.defineProperty(file, 'size', { value: MAX_DOCUMENT_SIZE_BYTES + 1 })
    file.arrayBuffer = () => {
      throw new Error('must not be read')
    }

    const generator = documentAttachmentAdapter.add({ file })
    await expect(
      (generator as AsyncGenerator<unknown>).next()
    ).rejects.toMatchObject({ code: DOCUMENT_ERROR_CODE.tooLarge })
  })

  test('turns a text file into one document text part', async () => {
    const file = new File(['hello'], 'notes.md', { type: '' })
    const states: {
      type: string
      status: { type: string }
      content?: unknown[]
    }[] = []
    for await (const state of documentAttachmentAdapter.add({
      file,
    }) as AsyncGenerator<(typeof states)[number]>) {
      states.push(state)
    }

    expect(states.map((state) => state.status.type)).toEqual([
      'running',
      'requires-action',
    ])
    const blocks = extractDocumentBlocks(states.slice(-1))
    expect(parseMessageDocuments(blocks[0]).documents[0]).toMatchObject({
      name: 'notes.md',
      text: 'hello',
    })
  })

  test('reports a text file without content as unreadable', async () => {
    const file = new File(['  \n '], 'empty.txt', { type: 'text/plain' })
    const generator = documentAttachmentAdapter.add({
      file,
    }) as AsyncGenerator<unknown>

    await generator.next()
    await expect(generator.next()).rejects.toMatchObject({
      code: DOCUMENT_ERROR_CODE.noText,
    })
  })

  test('recognises documents by extension when the type is missing', () => {
    expect(getDocumentKind({ name: 'a.CSV', type: '' })).toBe('text')
    expect(getDocumentKind({ name: 'b.docx', type: '' })).toBe('docx')
    expect(getDocumentKind({ name: 'c.png', type: 'image/png' })).toBeNull()
  })
})
