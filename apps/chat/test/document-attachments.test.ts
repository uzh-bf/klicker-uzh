import JSZip from 'jszip'
import { describe, expect, test } from 'vitest'
import { extractDocumentBlocks } from '../src/lib/attachments/attachmentState'
import {
  DOCUMENT_ERROR_CODE,
  documentAttachmentAdapter,
  extractPptxSlides,
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
      buildDocumentBlock({
        name: 'deck.pptx',
        text: 'Slide 1\nTitle',
        slides: 1,
        shortened: false,
      }),
    ])

    const parsed = parseMessageDocuments(text)

    expect(parsed.question).toBe('What is on page 2?')
    expect(parsed.documents).toEqual([
      {
        name: 'notes.pdf',
        pages: 2,
        slides: null,
        shortened: false,
        text: 'first page\n\nsecond page',
        tokenEstimate: estimateTokens('first page\n\nsecond page'),
      },
      {
        name: 'data.csv',
        pages: null,
        slides: null,
        shortened: true,
        text: 'a,b\n1,2',
        tokenEstimate: estimateTokens('a,b\n1,2'),
      },
      {
        name: 'deck.pptx',
        pages: null,
        slides: 1,
        shortened: false,
        text: 'Slide 1\nTitle',
        tokenEstimate: estimateTokens('Slide 1\nTitle'),
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
    expect(getDocumentKind({ name: 'd.PPTX', type: '' })).toBe('pptx')
    expect(getDocumentKind({ name: 'c.png', type: 'image/png' })).toBeNull()
  })
})

// A minimal deck whose slide files are numbered in the opposite order to the
// presentation's slide list, as happens after slides are reordered.
async function buildDeck(): Promise<ArrayBuffer> {
  const run = (text: string) => `<a:p><a:r><a:t>${text}</a:t></a:r></a:p>`
  const zip = new JSZip()
  zip.file(
    'ppt/presentation.xml',
    '<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId1"/></p:sldIdLst></p:presentation>'
  )
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    '<Relationships><Relationship Id="rId1" Type="x/slide" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="x/slide" Target="slides/slide2.xml"/></Relationships>'
  )
  zip.file(
    'ppt/slides/slide2.xml',
    `<p:sld>${run('Net present value')}${run('Cash flows &amp; rates')}<a:p><a:fld type="slidenum"><a:t>1</a:t></a:fld></a:p></p:sld>`
  )
  zip.file('ppt/slides/slide1.xml', `<p:sld>${run('Summary')}</p:sld>`)
  zip.file(
    'ppt/slides/_rels/slide2.xml.rels',
    '<Relationships><Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide1.xml"/></Relationships>'
  )
  zip.file(
    'ppt/notesSlides/notesSlide1.xml',
    `<p:notes>${run('Mention the 10% rate')}</p:notes>`
  )
  return zip.generateAsync({ type: 'arraybuffer' })
}

describe('PowerPoint extraction', () => {
  test('reads slides in presentation order with notes and without fields', async () => {
    expect(await extractPptxSlides(await buildDeck())).toEqual([
      'Net present value\nCash flows & rates\nSpeaker notes: Mention the 10% rate',
      'Summary',
    ])
  })

  test('labels each slide and records the slide count', async () => {
    const file = new File([await buildDeck()], 'deck.pptx', { type: '' })
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

    const [block] = extractDocumentBlocks(states.slice(-1))
    const [document] = parseMessageDocuments(block).documents
    expect(document.slides).toBe(2)
    expect(document.text).toMatch(
      /^Slide 1\nNet present value[\s\S]*\n\nSlide 2\nSummary$/
    )
  })
})
