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
