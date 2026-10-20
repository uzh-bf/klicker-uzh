/// <reference lib="webworker" />

// Runs PDF text extraction off the main thread so a large file does not
// freeze the chat while it is parsed.
import { extractPdfPages, PDF_TEXT_MESSAGE } from './pdfText'

self.onmessage = async (event: MessageEvent<unknown>) => {
  // Only the page that created this dedicated worker can post to it, and its
  // messages carry an empty origin. Anything else, or any message that is not
  // an extraction request, is ignored.
  if (event.origin !== '' && event.origin !== self.location.origin) return
  const request = event.data as { type?: unknown; data?: unknown } | null
  if (request?.type !== PDF_TEXT_MESSAGE) return
  if (!(request.data instanceof ArrayBuffer)) return

  try {
    const pages = await extractPdfPages(request.data)
    self.postMessage({ type: PDF_TEXT_MESSAGE, ok: true, pages })
  } catch (error) {
    self.postMessage({
      type: PDF_TEXT_MESSAGE,
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
