import { useRouter } from 'next/router'
import { useEffect } from 'react'

function safeRedirectPath(rawRedirect: string | null) {
  if (!rawRedirect) {
    return '/'
  }

  try {
    const redirect = decodeURIComponent(rawRedirect)

    if (
      redirect.startsWith('/') &&
      !redirect.startsWith('//') &&
      !redirect.includes('://')
    ) {
      return redirect
    }
  } catch {
    return '/'
  }

  return '/'
}

function withTrailingSlashRemoved(url: string) {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

function Login() {
  const router = useRouter()

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const origin = safeRedirectPath(urlParams.get('redirect_to'))
    const kbUrl = withTrailingSlashRemoved(
      process.env.NEXT_PUBLIC_KB_URL ?? 'https://kb.klicker.com'
    )
    const authUrl =
      process.env.NEXT_PUBLIC_AUTH_URL ?? 'https://auth.klicker.com'
    const redirection = encodeURIComponent(`${kbUrl}${origin}`)

    router.replace(`${authUrl}?redirectTo=${redirection}`)
  }, [router])

  return null
}

export default Login
