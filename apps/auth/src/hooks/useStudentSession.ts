import { useCallback, useEffect, useRef, useState } from 'react'

// Fixed participant session lookup for the assessment login UI.
//
// Unlike next-auth's generic useSession(), this hook queries the dedicated
// /api/student-session endpoint, which always interprets the request with the
// participant configuration. The four states are modelled separately:
// loading, a valid participant principal, no participant session, and a
// lookup error. Revalidation happens after login (manual refetch), window
// focus and logout; an existing lecturer session neither satisfies nor
// blocks assessment login.
//
// Initial, focus and manual lookups all run through one path and are ordered
// by a request generation: only the newest lookup may update state, so a slow
// authenticated or failed response cannot overwrite a later result (for
// example the signed-out result after logout), and responses of an obsolete
// effect generation are dropped after unmount.

export type StudentSessionStatus =
  | 'loading'
  | 'authenticated'
  | 'unauthenticated'
  | 'error'

export interface StudentSessionParticipant {
  id: string
  email: string | null
}

interface StudentSessionResponse {
  participant: StudentSessionParticipant | null
}

async function fetchStudentSession(): Promise<StudentSessionResponse> {
  const response = await fetch('/api/student-session', { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`student-session lookup failed: ${response.status}`)
  }
  return (await response.json()) as StudentSessionResponse
}

function applyResponse(
  data: StudentSessionResponse,
  setParticipant: (p: StudentSessionParticipant | null) => void,
  setStatus: (s: StudentSessionStatus) => void
) {
  setParticipant(data.participant ?? null)
  setStatus(data.participant ? 'authenticated' : 'unauthenticated')
}

export function useStudentSession() {
  const [status, setStatus] = useState<StudentSessionStatus>('loading')
  const [participant, setParticipant] =
    useState<StudentSessionParticipant | null>(null)
  const activeRef = useRef(true)
  const generationRef = useRef(0)

  const lookup = useCallback(() => {
    generationRef.current += 1
    const generation = generationRef.current

    return fetchStudentSession().then(
      (data) => {
        if (activeRef.current && generation === generationRef.current) {
          applyResponse(data, setParticipant, setStatus)
        }
      },
      () => {
        if (activeRef.current && generation === generationRef.current) {
          setStatus('error')
        }
      }
    )
  }, [])

  useEffect(() => {
    activeRef.current = true

    // State updates only run inside promise callbacks, never synchronously
    // within the effect body.
    void lookup()

    const onFocus = () => {
      void lookup()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      activeRef.current = false
      window.removeEventListener('focus', onFocus)
    }
  }, [lookup])

  return { status, participant, refetch: lookup }
}
