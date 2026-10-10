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

  // Trimmed without a regex: a backtracking `\/+$` on a configured value is a
  // polynomial-time pattern, and a plain scan is both linear and clearer.
  let end = accountUrl.length
  while (end > 0 && accountUrl.charCodeAt(end - 1) === 47) {
    end -= 1
  }
  return accountUrl.slice(0, end)
}
