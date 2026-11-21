'use client'

import { useSyncExternalStore } from 'react'

const subscribeToNothing = () => () => {}

function getFramedSnapshot() {
  try {
    return window.self !== window.top
  } catch {
    // Reading `window.top` can throw in a sandboxed cross-origin frame, which
    // is itself proof of being framed.
    return true
  }
}

/**
 * Whether the chat document runs inside a host frame, such as an LMS LTI
 * launch. This is independent of `useEmbedded`, which reads the explicit
 * `?embed=1` layout contract: an LMS frames the full layout without that
 * marker. The server cannot know, so it renders the unframed layout and the
 * client corrects it after hydration.
 */
export function useFramed(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    getFramedSnapshot,
    () => false
  )
}
