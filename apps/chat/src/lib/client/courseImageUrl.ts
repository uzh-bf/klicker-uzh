import { authedFetch } from './authedFetch'

/** Fetch through the same cookie/Bearer transport as Chat, never URL tokens. */
export async function loadCourseImageUrl(src: string, signal: AbortSignal) {
  const response = await authedFetch(src, {
    signal,
    credentials: 'same-origin',
  })
  if (!response.ok) throw new Error('Course image unavailable')
  const blob = await response.blob()
  signal.throwIfAborted()
  // The authenticated endpoint validates the stored PNG before returning it.
  return URL.createObjectURL(blob)
}
