export function getBlobStorageAccountUrl(
  accountName: string,
  configuredAccountUrl?: string
) {
  const accountUrl =
    configuredAccountUrl?.trim() ||
    `https://${accountName.trim()}.blob.core.windows.net`

  let parsedUrl: URL
  try {
    parsedUrl = new URL(accountUrl)
  } catch {
    throw new Error('Blob storage account URL is invalid')
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Blob storage account URL is invalid')
  }

  return accountUrl.replace(/\/+$/, '')
}
