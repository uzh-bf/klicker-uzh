import { GetServerSideProps } from 'next'

function Login() {
  return null
}

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const manageUrl = process.env.NEXT_PUBLIC_MANAGE_URL as string
  const authUrl = process.env.NEXT_PUBLIC_AUTH_URL as string
  const manageOrigin = new URL(manageUrl)
  const redirectTo = Array.isArray(query.redirect_to)
    ? query.redirect_to[0]
    : query.redirect_to

  let target = new URL('/', manageOrigin)
  try {
    const requestedTarget = new URL(redirectTo ?? '/', manageOrigin)
    if (requestedTarget.origin === manageOrigin.origin) {
      target = requestedTarget
    }
  } catch {
    // Fall back to the manage root for malformed return targets.
  }

  return {
    redirect: {
      destination: `${authUrl}?redirectTo=${encodeURIComponent(target.toString())}`,
      permanent: false,
    },
  }
}

export default Login
