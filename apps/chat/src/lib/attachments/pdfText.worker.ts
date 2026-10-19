/// <reference lib="webworker" />

// Runs PDF text extraction off the main thread so a large file does not
// freeze the chat while it is parsed.
import { extractPdfPages } from './pdfText'

self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  try {
    const pages = await extractPdfPages(event.data)
    self.postMessage({ ok: true, pages })
  } catch (error) {
    self.postMessage({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
