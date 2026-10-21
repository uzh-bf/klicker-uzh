import { describe, expect, test, vi } from 'vitest'
import {
  extractDocumentBlocks,
  extractDocumentsForSending,
} from '../src/lib/attachments/attachmentState'
import {
  DOCUMENT_ERROR_CODE,
  documentAttachmentAdapter,
  getDocumentKind,
} from '../src/lib/attachments/documentAttachmentAdapter'
import {
  applyVisualReview,
  buildDocumentBlock,
  composeMessageText,
  estimateTokens,
  MAX_DOCUMENT_SIZE_BYTES,
  MAX_DOCUMENT_TOKENS,
  parseMessageDocuments,
  stripDocumentBlocks,
  truncateDocumentText,
  type VisualReviewStatus,
} from '../src/lib/attachments/documentText'
import { readPdf } from '../src/lib/attachments/pdfText'

const fakePdf = vi.hoisted(() => ({ numPages: 0, renderFails: false }))

// PDF.js and canvas rendering need a browser; the stand-ins only report page
// counts and record how many pages were drawn.
vi.mock('unpdf', () => ({
  getDocumentProxy: async () => ({
    numPages: fakePdf.numPages,
    loadingTask: { destroy: async () => {} },
    getPage: async () => ({
      getViewport: ({ scale }: { scale: number }) => ({
        width: 800 * scale,
        height: 600 * scale,
      }),
      render: () => ({
        promise: fakePdf.renderFails
          ? Promise.reject(new Error('render failed'))
          : Promise.resolve(),
      }),
      cleanup: () => {},
    }),
  }),
  extractText: async () => ({
    text: Array.from({ length: fakePdf.numPages }, (_, i) => `page ${i + 1}`),
  }),
}))

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
        visualReview: null,
        text: 'first page\n\nsecond page',
        tokenEstimate: estimateTokens('first page\n\nsecond page'),
      },
      {
        name: 'data.csv',
        pages: null,
        shortened: true,
        visualReview: null,
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

  test('asks for a PDF instead of reading a PowerPoint file', async () => {
    const file = new File(['x'], 'slides.pptx', { type: '' })
    const generator = documentAttachmentAdapter.add({
      file,
    }) as AsyncGenerator<unknown>

    await expect(generator.next()).rejects.toMatchObject({
      code: DOCUMENT_ERROR_CODE.presentation,
    })
  })

  test('recognises documents by extension when the type is missing', () => {
    expect(getDocumentKind({ name: 'a.CSV', type: '' })).toBe('text')
    expect(getDocumentKind({ name: 'b.docx', type: '' })).toBe('docx')
    expect(getDocumentKind({ name: 'c.png', type: 'image/png' })).toBeNull()
  })
})

const pdfBlock = (visualReview: VisualReviewStatus | null, pages = 3) =>
  buildDocumentBlock({
    name: 'slides.pdf',
    text: 'slide text',
    pages,
    shortened: false,
    visualReview,
  })

describe('visual review of PDF pages', () => {
  test.each<VisualReviewStatus>([
    'reviewed',
    'too-many-pages',
    'no-image-support',
    'skipped',
  ])('keeps the %s status through the stored text', (visualReview) => {
    const [document] = parseMessageDocuments(
      composeMessageText('Question', [pdfBlock(visualReview)])
    ).documents
    expect(document).toMatchObject({ pages: 3, visualReview })
  })

  test('sends pages of documents that fit into ten pages per message', () => {
    const pages = (count: number) => Array(count).fill('data:image/jpeg;x')
    const { blocks, pageImages } = applyVisualReview(
      [
        { block: pdfBlock('reviewed', 7), pageImages: pages(7) },
        { block: pdfBlock('reviewed', 3), pageImages: pages(3) },
        { block: pdfBlock('reviewed', 1), pageImages: pages(1) },
      ],
      { supportsImages: true }
    )

    expect(pageImages).toHaveLength(10)
    expect(
      blocks.map(
        (block) => parseMessageDocuments(block).documents[0]?.visualReview
      )
    ).toEqual(['reviewed', 'reviewed', 'too-many-pages'])
  })

  test('sends no pages when the model cannot read images', () => {
    const { blocks, pageImages } = applyVisualReview(
      [{ block: pdfBlock('reviewed'), pageImages: ['data:image/jpeg;x'] }],
      { supportsImages: false }
    )
    expect(pageImages).toEqual([])
    expect(parseMessageDocuments(blocks[0]).documents[0]?.visualReview).toBe(
      'no-image-support'
    )
  })

  test('drops the text-only reason once a model that reads images sends it', () => {
    const { blocks } = applyVisualReview(
      [{ block: pdfBlock('no-image-support'), pageImages: [] }],
      { supportsImages: true }
    )
    expect(parseMessageDocuments(blocks[0]).documents[0]?.visualReview).toBe(
      'skipped'
    )
  })

  test('marks kept pages of an edited message as not reviewed', () => {
    const { blocks, pageImages } = applyVisualReview(
      [{ block: pdfBlock('reviewed'), pageImages: [] }],
      { supportsImages: true }
    )
    expect(pageImages).toEqual([])
    expect(parseMessageDocuments(blocks[0]).documents[0]?.visualReview).toBe(
      'skipped'
    )
  })

  test('takes page images only from document attachments', () => {
    const documents = extractDocumentsForSending([
      {
        type: 'document',
        content: [
          { type: 'text', text: pdfBlock('reviewed') },
          { type: 'file', mimeType: 'image/jpeg', data: 'data:image/jpeg;1' },
        ],
      },
      {
        type: 'image',
        content: [{ type: 'image', image: 'data:image/png;2' }],
      },
    ])
    expect(documents).toEqual([
      { block: pdfBlock('reviewed'), pageImages: ['data:image/jpeg;1'] },
    ])
  })
})

describe('readPdf page rendering', () => {
  const stubCanvas = () => {
    class FakeCanvas {
      constructor(
        public width: number,
        public height: number
      ) {}
      getContext() {
        return { fillRect: () => {}, fillStyle: '' }
      }
      async convertToBlob() {
        return new Blob(['jpeg'], { type: 'image/jpeg' })
      }
    }
    class FakeReader {
      result: string | null = null
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      readAsDataURL() {
        this.result = 'data:image/jpeg;base64,anBlZw=='
        this.onload?.()
      }
    }
    vi.stubGlobal('OffscreenCanvas', FakeCanvas)
    vi.stubGlobal('FileReader', FakeReader)
  }

  test('renders every page of a ten-page PDF', async () => {
    stubCanvas()
    fakePdf.numPages = 10
    const result = await readPdf(new ArrayBuffer(8), { maxRenderedPages: 10 })
    expect(result.pages).toHaveLength(10)
    expect(result.pageImages).toHaveLength(10)
  })

  test('renders no page of an eleven-page PDF', async () => {
    stubCanvas()
    fakePdf.numPages = 11
    const result = await readPdf(new ArrayBuffer(8), { maxRenderedPages: 10 })
    expect(result.pages).toHaveLength(11)
    expect(result.pageImages).toBeNull()
  })

  test('keeps the text when page rendering fails', async () => {
    stubCanvas()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    fakePdf.numPages = 3
    fakePdf.renderFails = true
    const result = await readPdf(new ArrayBuffer(8), { maxRenderedPages: 10 })
    fakePdf.renderFails = false
    expect(result.pages).toHaveLength(3)
    expect(result.pageImages).toBeNull()
  })

  test('renders nothing for a text-only model', async () => {
    stubCanvas()
    fakePdf.numPages = 2
    const result = await readPdf(new ArrayBuffer(8))
    expect(result.pageImages).toBeNull()
  })
})
