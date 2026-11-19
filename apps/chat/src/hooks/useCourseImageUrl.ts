'use client'

import { useEffect, useState } from 'react'
import { loadCourseImageUrl } from '../lib/client/courseImageUrl'

export function useCourseImageUrl(src: string, attempt: number) {
  const [result, setResult] = useState<{
    src: string
    attempt: number
    url?: string
    failed?: boolean
  }>()
  useEffect(() => {
    const controller = new AbortController()
    let ownedUrl: string | undefined
    void loadCourseImageUrl(src, controller.signal).then(
      (url) => {
        if (controller.signal.aborted) {
          URL.revokeObjectURL(url)
          return
        }
        ownedUrl = url
        setResult({ src, attempt, url })
      },
      () => {
        if (!controller.signal.aborted)
          setResult({ src, attempt, failed: true })
      }
    )
    return () => {
      controller.abort()
      if (ownedUrl) URL.revokeObjectURL(ownedUrl)
    }
  }, [src, attempt])
  // Never display the previous message's image while its replacement loads.
  return result?.src === src && result.attempt === attempt ? result : undefined
}
