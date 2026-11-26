import type { ActivityArtifactExercise } from '@klicker-uzh/types'
import { useCallback, useEffect, useMemo, useRef } from 'react'

interface ActivityArtifactFrameProps {
  frameUrl: string
  canonicalUrl: string
  title: string
  exercise: ActivityArtifactExercise
  className?: string
}

/**
 * Trusted numeric renderer for an attached activity artifact.
 *
 * The host accepts only the fixed `/frame` route of the configured publisher
 * origin, renders it with `sandbox="allow-scripts"` and sends nothing through
 * the URL. The sandboxed child is opaque-origin, so its browser origin cannot
 * be named as a target origin. The message therefore goes to `*` while being
 * addressed to this frame's own content window only. The frame itself checks
 * that the sender is its parent and that the parent origin is trusted.
 */
function ActivityArtifactFrame({
  frameUrl,
  canonicalUrl,
  title,
  exercise,
  className,
}: ActivityArtifactFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null)

  const frameSrc = useMemo(() => {
    try {
      const url = new URL(frameUrl)
      const canonical = new URL(canonicalUrl)
      if (url.protocol !== 'https:') return null
      if (canonical.protocol !== 'https:') return null
      if (url.origin !== canonical.origin) return null
      if (url.pathname !== '/frame') return null
      if (url.search !== '' || url.hash !== '') return null
      if (url.username !== '' || url.password !== '') return null
      return url.toString()
    } catch {
      return null
    }
  }, [canonicalUrl, frameUrl])

  const sendExercise = useCallback(() => {
    const frame = frameRef.current
    if (!frame || !frame.contentWindow) return

    // Read the window at send time. This addresses only this iframe instance,
    // including on every load, never other frames or the top-level page.
    frame.contentWindow.postMessage(
      { type: 'activity-artifact', exercise },
      '*'
    )
  }, [exercise])

  // A fresh authorized response replaces the rendered exercise. The frame
  // re-mounts the definition on every message it accepts.
  useEffect(() => {
    sendExercise()
  }, [sendExercise])

  if (!frameSrc) return null

  return (
    <iframe
      ref={frameRef}
      src={frameSrc}
      title={title}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      onLoad={sendExercise}
      className={className}
    />
  )
}

export default ActivityArtifactFrame
