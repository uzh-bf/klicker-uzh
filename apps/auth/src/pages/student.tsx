import { signIn } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

function isValidStudentRedirectUrl(url: string): boolean {
  if (!url) return false

  try {
    const parsed = new URL(url)
    const allowedDomains = [
      'assessment.klicker.uzh.ch',
      // Development
      'assessment.klicker.com',
      'pwa.klicker.com',
    ]

    return allowedDomains.some(
      (domain) =>
        parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    )
  } catch {
    return false
  }
}

export default function Student() {
  const router = useRouter()

  useEffect(() => {
    const redirectTo = router.query.redirectTo as string
    if (!redirectTo || !isValidStudentRedirectUrl(redirectTo)) {
      console.error('Invalid or missing redirectTo URL:', redirectTo)
      return
    }

    // Directly trigger NextAuth sign-in with callback to PWA
    signIn('eduid-participant', {
      callbackUrl: redirectTo,
    })
  }, [router])

  return (
    <div className="flex h-full flex-col items-center justify-center">
      <div className="text-center">
        <h1 className="mb-4 text-2xl font-semibold">
          Redirecting to Edu-ID...
        </h1>
        <p className="text-gray-600">
          Please wait while we redirect you to the authentication service.
        </p>
      </div>
    </div>
  )
}
