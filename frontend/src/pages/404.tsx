import Error from 'next/error'
import { useEffect } from 'react'
import { push } from '@socialgouv/matomo-next'
import { useRouter } from 'next/router'

export default function NotFound() {
  const router = useRouter()
  useEffect(() => {
    push(['trackEvent', 'Error', '404', router.pathname])
  }, [])
  // Opinionated: do not record an exception in Sentry for 404
  return <Error statusCode={404} />
}
