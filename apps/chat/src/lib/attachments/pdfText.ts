// PDF.js recognises a worker scope and posts its own handshake messages on
// `self`, so the extraction result carries a tag the main thread can filter on.
export const PDF_TEXT_MESSAGE = 'klicker-pdf-text'

// Page images are scaled so their longest side is about this many pixels:
// enough for slide text and figures, small enough for a 10-page request.
const PAGE_IMAGE_LONGEST_SIDE = 1600
const PAGE_IMAGE_QUALITY = 0.8

export type PdfReadResult = {
  /** One string per page. */
  pages: string[]
  /** JPEG data URLs, one per page, or null when the pages were not rendered. */
  pageImages: string[] | null
}

type CanvasAndContext = {
  canvas: OffscreenCanvas | null
  context: OffscreenCanvasRenderingContext2D | null
}

// PDF.js creates its scratch canvases through the document by default, and a
// worker has no document. OffscreenCanvas works in both scopes.
class OffscreenCanvasFactory {
  create(width: number, height: number): CanvasAndContext {
    const canvas = new OffscreenCanvas(width, height)
    return { canvas, context: canvas.getContext('2d') }
  }

  reset(canvasAndContext: CanvasAndContext, width: number, height: number) {
    if (!canvasAndContext.canvas) return
    canvasAndContext.canvas.width = width
    canvasAndContext.canvas.height = height
  }

  destroy(canvasAndContext: CanvasAndContext) {
    if (canvasAndContext.canvas) {
      canvasAndContext.canvas.width = 0
      canvasAndContext.canvas.height = 0
    }
    canvasAndContext.canvas = null
    canvasAndContext.context = null
  }
}

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

/**
 * Reads the text of every page and, when `maxRenderedPages` allows it,
 * renders every page as a downscaled JPEG. A document with more pages than
 * that is not rendered at all, so a review never covers only part of it.
 */
export async function readPdf(
  data: ArrayBuffer,
  { maxRenderedPages = 0 }: { maxRenderedPages?: number } = {}
): Promise<PdfReadResult> {
  const { extractText, getDocumentProxy } = await import('unpdf')
  const inWorker = typeof document === 'undefined'
  const pdf = await getDocumentProxy(new Uint8Array(data), {
    CanvasFactory: OffscreenCanvasFactory,
    // Font loading goes through document.fonts; without a document, PDF.js
    // draws the glyphs as paths instead.
    disableFontFace: inWorker,
  })
  try {
    const { text } = await extractText(pdf, { mergePages: false })
    const canRender =
      typeof OffscreenCanvas !== 'undefined' &&
      pdf.numPages > 0 &&
      pdf.numPages <= maxRenderedPages
    if (!canRender) return { pages: text, pageImages: null }

    try {
      return { pages: text, pageImages: await renderPages(pdf) }
    } catch (error) {
      // Rendering is more fragile than text extraction; the text still goes
      // through, only without the page images.
      console.warn('PDF page rendering failed:', error)
      return { pages: text, pageImages: null }
    }
  } finally {
    await pdf.loadingTask.destroy()
  }
}

async function renderPages(
  pdf: Awaited<ReturnType<typeof import('unpdf').getDocumentProxy>>
): Promise<string[]> {
  const canvasFactory = new OffscreenCanvasFactory()
  const pageImages: string[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const { width, height } = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({
      scale: PAGE_IMAGE_LONGEST_SIDE / Math.max(width, height),
    })
    const target = canvasFactory.create(
      Math.round(viewport.width),
      Math.round(viewport.height)
    )
    try {
      const { canvas, context } = target as {
        canvas: OffscreenCanvas
        context: OffscreenCanvasRenderingContext2D
      }
      // JPEG has no transparency, and PDF pages assume a white sheet.
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: context as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise
      const blob = await canvas.convertToBlob({
        type: 'image/jpeg',
        quality: PAGE_IMAGE_QUALITY,
      })
      pageImages.push(await blobToDataUrl(blob))
    } finally {
      canvasFactory.destroy(target)
      page.cleanup()
    }
  }
  return pageImages
}
