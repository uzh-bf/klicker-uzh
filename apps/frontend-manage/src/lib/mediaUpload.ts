interface MediaUpload {
  uploadUrl: string
  uploadHref: string
  uploadHeaders: { name: string; value: string }[]
}

/** Provider-neutral transport: signed URLs and required headers come from the API. */
export async function uploadMediaFile(
  file: File,
  upload: MediaUpload | null | undefined,
  fetcher: typeof fetch = fetch
) {
  if (!upload) throw new Error('Media upload could not be prepared')
  const response = await fetcher(upload.uploadUrl, {
    method: 'PUT',
    headers: Object.fromEntries(
      upload.uploadHeaders.map(({ name, value }) => [name, value])
    ),
    body: file,
    credentials: 'omit',
    // A redirect can invalidate a signature or send a private bearer URL to a
    // different service. Upload to the configured endpoint exactly.
    redirect: 'error',
  })
  // Never expose a signed URL or provider response body in the user-facing error.
  if (!response.ok) throw new Error('Media upload failed')
  return upload.uploadHref
}
