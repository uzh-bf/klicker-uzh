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
 * the URL. The opaque child starts the connection by transferring a
 * MessagePort to a configured parent origin. The host accepts that port only
 * from this iframe, then sends exercises over the private port.
 */
function ActivityArtifactFrame({
  frameUrl,
  canonicalUrl,
  title,
  exercise,
  className,
}: ActivityArtifactFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const framePortRef = useRef<MessagePort | null>(null)
  const lastSentPayloadRef = useRef<string | null>(null)
  const exerciseRef = useRef(exercise)
  const exercisePayload = useMemo(() => JSON.stringify(exercise), [exercise])
  const exercisePayloadRef = useRef(exercisePayload)

  // Keep the event listener stable without allowing a prop update to race a
  // port handshake. JavaScript delivers the message after the current render.
  exerciseRef.current = exercise
  exercisePayloadRef.current = exercisePayload

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

  const sendExercise = useCallback((port: MessagePort | null) => {
    if (!port) return
    port.postMessage({
      type: 'activity-artifact',
      exercise: exerciseRef.current,
    })
    lastSentPayloadRef.current = exercisePayloadRef.current
  }, [])

  const handleFrameMessage = useCallback(
    (event: MessageEvent) => {
      const frame = frameRef.current
      if (!frame?.contentWindow || event.source !== frame.contentWindow) return

      // A sandboxed child has an opaque origin. Its exact WindowProxy above
      // binds the message to this iframe while this check requires sandboxing.
      if (event.origin !== 'null') return
      const data = event.data as { type?: unknown } | null
      if (data?.type !== 'activity-artifact-ready') return

      const port = event.ports[0]
      if (!port) return
      framePortRef.current?.close()
      framePortRef.current = port
      sendExercise(port)
    },
    [sendExercise]
  )

  const setFrameRef = useCallback(
    (frame: HTMLIFrameElement | null) => {
      // Current callers render this only after a client query or preview
      // action, so the listener is installed before the iframe document can
      // send its one-shot handshake. A server-rendered caller needs a listener
      // established before that HTML reaches the browser.
      if (frameRef.current === frame) return
      window.removeEventListener('message', handleFrameMessage)
      framePortRef.current?.close()
      framePortRef.current = null
      lastSentPayloadRef.current = null
      frameRef.current = frame
      if (frame) window.addEventListener('message', handleFrameMessage)
    },
    [handleFrameMessage]
  )

  // A fresh authorized response replaces the rendered exercise. The frame
  // preserves its rendered state when the serialized definition is unchanged.
  useEffect(() => {
    if (lastSentPayloadRef.current === exercisePayload) return
    sendExercise(framePortRef.current)
  }, [exercisePayload, sendExercise])

  if (!frameSrc) return null

  return (
    <iframe
      key={frameSrc}
      ref={setFrameRef}
      src={frameSrc}
      title={title}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      className={className}
    />
  )
}

export default ActivityArtifactFrame
