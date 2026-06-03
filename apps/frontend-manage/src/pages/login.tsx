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
  let target = new URL(redirectTo ?? '/', manageUrl)

  if (target.origin !== manageOrigin.origin) {
    target = manageOrigin
  }

  return {
    redirect: {
      destination: `${authUrl}?redirectTo=${encodeURIComponent(
        target.toString()
      )}`,
      permanent: false,
    },
  }
}

export default Login
