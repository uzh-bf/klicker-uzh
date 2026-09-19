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

  useEffect(() => {
    activeRef.current = true

    // State updates only run inside promise callbacks, never synchronously
    // within the effect body.
    fetchStudentSession().then(
      (data) => {
        if (activeRef.current) {
          applyResponse(data, setParticipant, setStatus)
        }
      },
      () => {
        if (activeRef.current) {
          setStatus('error')
        }
      }
    )

    const onFocus = () => {
      fetchStudentSession().then(
        (data) => {
          if (activeRef.current) {
            applyResponse(data, setParticipant, setStatus)
          }
        },
        () => {
          if (activeRef.current) {
            setStatus('error')
          }
        }
      )
    }
    window.addEventListener('focus', onFocus)
    return () => {
      activeRef.current = false
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  const refetch = useCallback(async () => {
    try {
      const data = await fetchStudentSession()
      applyResponse(data, setParticipant, setStatus)
    } catch {
      setStatus('error')
    }
  }, [])

  return { status, participant, refetch }
}
