import { useRouter } from 'next/router'
import { useEffect } from 'react'

export default function DiscourseHandoff() {
  const router = useRouter()

  useEffect(() => {
    if (!router.query.sso || !router.query.sig) {
      return
    }

    const fetcher = async () => {
      const data = await fetch('/api/discourse', {
        method: 'POST',
        body: JSON.stringify({
          sso: router.query.sso,
          sig: router.query.sig,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      const json = await data.json()

      if (data?.status === 200) {
        router.push(json.redirectURL)
      }
    }

    fetcher()
  }, [router, router.query.sso, router.query.sig])

  return null
}
