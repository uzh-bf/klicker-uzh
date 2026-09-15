'use client'

import { unstable_useComposerInput } from '@assistant-ui/react'
import {
  parseHandoffSource,
  parseHandoffTopic,
} from '@klicker-uzh/shared-components/src/utils/handoff'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { rememberHandoffSource } from '../lib/handoff'

const PREFILL_INTERVAL_MS = 100
const PREFILL_ATTEMPTS = 15

/**
 * Fills the composer from a handoff link's topic without sending it, then drops
 * the handoff parameters from the address bar so a reload starts clean. The
 * prefill retries briefly because the composer is not editable yet when the
 * handoff route first renders, and it only ever fills an empty composer.
 */
export function HandoffPrefill() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { setText, value } = unstable_useComposerInput()
  const [topic, setTopic] = useState<string>()
  const [attempt, setAttempt] = useState(0)
  const consumed = useRef(false)
  const applied = useRef(false)

  useEffect(() => {
    if (consumed.current) {
      return
    }
    if (!searchParams.has('q') && !searchParams.has('src')) {
      return
    }
    consumed.current = true
    setTopic(parseHandoffTopic(searchParams.get('q')))
    rememberHandoffSource(parseHandoffSource(searchParams.get('src')))

    const remaining = new URLSearchParams(searchParams.toString())
    remaining.delete('q')
    remaining.delete('src')
    const query = remaining.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  useEffect(() => {
    if (!topic || applied.current) {
      return
    }
    // The fill landed; stop retrying so a later deliberate clear stays cleared.
    if (value === topic) {
      applied.current = true
      return
    }
    // Anything else in the composer is the student's own writing or a
    // suggestion they picked; the handoff topic never overwrites it.
    if (value !== '' || attempt >= PREFILL_ATTEMPTS) {
      return
    }

    setText(topic)
    const timer = window.setTimeout(
      () => setAttempt((current) => current + 1),
      PREFILL_INTERVAL_MS
    )

    return () => window.clearTimeout(timer)
  }, [attempt, setText, topic, value])

  return null
}
