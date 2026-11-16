/// <reference lib="webworker" />

// Runs PDF text extraction and page rendering off the main thread so a large
// file does not freeze the chat while it is parsed.
import { PDF_TEXT_MESSAGE, readPdf } from './pdfText'

self.onmessage = async (event: MessageEvent<unknown>) => {
  // Only the page that created this dedicated worker can post to it, and its
  // messages carry an empty origin. Anything else, or any message that is not
  // an extraction request, is ignored.
  if (event.origin !== '' && event.origin !== self.location.origin) return
  const request = event.data as {
    type?: unknown
    data?: unknown
    maxRenderedPages?: unknown
  } | null
  if (request?.type !== PDF_TEXT_MESSAGE) return
  if (!(request.data instanceof ArrayBuffer)) return
  const maxRenderedPages =
    typeof request.maxRenderedPages === 'number' ? request.maxRenderedPages : 0

  try {
    const result = await readPdf(request.data, { maxRenderedPages })
    self.postMessage({ type: PDF_TEXT_MESSAGE, ok: true, ...result })
  } catch (error) {
    self.postMessage({
      type: PDF_TEXT_MESSAGE,
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
