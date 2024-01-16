import { useRouter } from 'next/router'
import { useEffect } from 'react'

export default function Discourse() {
  const router = useRouter()

  useEffect(() => {
    if (
      typeof router.query?.sso !== 'undefined' ||
      typeof router.query?.sig !== 'undefined'
    ) {
      location.replace(
        `/api/auth/signin?callbackUrl=${encodeURIComponent(
          `${process.env.NEXT_PUBLIC_AUTH_URL}/discourse_handoff?sso=` +
            router.query.sso +
            '&sig=' +
            router.query.sig
        )}`
      )
    }
  }, [router])

  return null
}
