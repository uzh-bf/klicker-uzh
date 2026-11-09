export const ELEMENT_WORKBOOK_MAX_BYTES = 5 * 1024 * 1024
export const ELEMENT_WORKBOOK_MAX_EXPORT = 2000
const XLSX_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export function downloadBase64Workbook(filename: string, base64: string) {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: XLSX_TYPE }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/** Uploads directly to blob storage through a create-only signed link. */
export async function uploadWorkbookFile(uploadUrl: string, file: File) {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': XLSX_TYPE },
    body: file,
  })
  if (!response.ok) throw new Error(`Upload failed (${response.status})`)
}

/** The signed link sets Content-Disposition, so the browser saves the file. */
export function downloadWorkbookUrl(downloadUrl: string) {
  const anchor = document.createElement('a')
  anchor.href = downloadUrl
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}
