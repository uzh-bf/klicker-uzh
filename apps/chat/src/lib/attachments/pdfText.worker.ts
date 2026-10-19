/// <reference lib="webworker" />

// Runs PDF text extraction off the main thread so a large file does not
// freeze the chat while it is parsed.
import { extractPdfPages, PDF_TEXT_MESSAGE } from './pdfText'

self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  try {
    const pages = await extractPdfPages(event.data)
    self.postMessage({ type: PDF_TEXT_MESSAGE, ok: true, pages })
  } catch (error) {
    self.postMessage({
      type: PDF_TEXT_MESSAGE,
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
