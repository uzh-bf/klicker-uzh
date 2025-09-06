import { signOut } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

export default function Logout() {
  const router = useRouter()

  useEffect(() => {
    async function exec() {
      try {
        // Sign out from NextAuth first
        await signOut({ redirect: false })

        // Clear all possible session cookies manually to prevent conflicts
        if (typeof window !== 'undefined') {
          // Clear lecturer session cookie
          document.cookie =
            'next-auth.session-token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=' +
            (process.env.NEXT_PUBLIC_COOKIE_DOMAIN || '.klicker.com')
          document.cookie =
            'next-auth.session-token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;'

          // Clear participant session cookie
          document.cookie =
            'next-auth.participant-session-token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=' +
            (process.env.NEXT_PUBLIC_COOKIE_DOMAIN || '.klicker.com')
          document.cookie =
            'next-auth.participant-session-token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;'

          // Clear any remaining auth context cookies
          document.cookie =
            'auth-context=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=' +
            (process.env.NEXT_PUBLIC_COOKIE_DOMAIN || '.klicker.com')
          document.cookie =
            'auth-context=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;'

          // Clear CSRF token cookies
          document.cookie =
            'next-auth.csrf-token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=' +
            (process.env.NEXT_PUBLIC_COOKIE_DOMAIN || '.klicker.com')
          document.cookie =
            'next-auth.csrf-token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;'
        }

        // Redirect to main website
        router.push('https://www.klicker.uzh.ch')
      } catch (error) {
        console.error('Error during logout:', error)
        // Still redirect even if there's an error
        router.push('https://www.klicker.uzh.ch')
      }
    }
    exec()
  }, [router])

  return (
    <div className="flex h-full flex-col items-center justify-center">
      <div className="text-center">
        <h1 className="mb-4 text-2xl font-semibold">Signing Out...</h1>
        <p className="text-gray-600">
          Please wait while we sign you out and clear all sessions.
        </p>
      </div>
    </div>
  )
}
