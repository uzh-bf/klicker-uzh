import Error from 'next/error'
import { useEffect } from 'react'
import { push } from '@socialgouv/matomo-next'

export default function NotFound() {
  useEffect(() => {
    push(['trackEvent', 'AAI Entrypoint', 'User Logged In'])
  }, [])
  // Opinionated: do not record an exception in Sentry for 404
  return <Error statusCode={404} />
}
