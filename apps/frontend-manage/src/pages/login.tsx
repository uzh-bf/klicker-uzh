import { useRouter } from 'next/router'
import { useEffect } from 'react'

function Login() {
  const router = useRouter()

  useEffect(() => {
    let origin = '/'

    const urlParams = new URLSearchParams(window?.location?.search)
    if (urlParams?.get('redirect_to')) {
      origin = decodeURIComponent(urlParams.get('redirect_to') as string)
    }

    const redirection = encodeURIComponent(
      `${process.env.NEXT_PUBLIC_MANAGE_URL as string}${origin}`
    )

    router.push(`${process.env.NEXT_PUBLIC_AUTH_URL}?redirectTo=${redirection}`)
  })

  return null
}

export default Login
