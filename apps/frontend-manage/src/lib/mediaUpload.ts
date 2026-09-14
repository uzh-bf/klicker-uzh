// @azure/storage-blob 12.25.0 switches uploadData to block staging above the
// shared limit. Direct media SAS tokens are create-only, so accepted uploads
// must remain within the SDK's single-request path.
export { DIRECT_MEDIA_UPLOAD_MAX_BYTES } from '@klicker-uzh/types'

export const MEDIA_UPLOAD_FINALIZATION_RETRY_DELAYS_MS = [250, 750] as const

type FinalizeMediaUpload = (mediaFileId: string) => Promise<boolean>
type Wait = (delayMs: number) => Promise<void>

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs))
}

export async function finalizeMediaUploadWithRetry(
  mediaFileId: string,
  finalize: FinalizeMediaUpload,
  waitForRetry: Wait = wait
): Promise<void> {
  let lastError: unknown = new Error('Uploaded media could not be finalized.')

  for (
    let attempt = 0;
    attempt <= MEDIA_UPLOAD_FINALIZATION_RETRY_DELAYS_MS.length;
    attempt++
  ) {
    try {
      if (await finalize(mediaFileId)) return
      lastError = new Error('Uploaded media could not be finalized.')
    } catch (error) {
      lastError = error
    }

    const retryDelay = MEDIA_UPLOAD_FINALIZATION_RETRY_DELAYS_MS[attempt]
    if (retryDelay === undefined) break
    await waitForRetry(retryDelay)
  }

  throw lastError
}
