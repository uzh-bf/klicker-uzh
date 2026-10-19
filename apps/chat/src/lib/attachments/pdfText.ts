// PDF.js recognises a worker scope and posts its own handshake messages on
// `self`, so the extraction result carries a tag the main thread can filter on.
export const PDF_TEXT_MESSAGE = 'klicker-pdf-text'

/** One string per page; `unpdf` bundles PDF.js with its own worker disabled. */
export async function extractPdfPages(data: ArrayBuffer): Promise<string[]> {
  const { extractText, getDocumentProxy } = await import('unpdf')
  const pdf = await getDocumentProxy(new Uint8Array(data))
  try {
    const { text } = await extractText(pdf, { mergePages: false })
    return text
  } finally {
    await pdf.loadingTask.destroy()
  }
}
