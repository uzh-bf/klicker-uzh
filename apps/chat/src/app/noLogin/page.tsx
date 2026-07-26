import { NoLoginSelfHeal } from '@/src/components/NoLoginSelfHeal'
import Link from 'next/link'

interface NoLoginPageProps {
  searchParams?: Promise<{
    redirectTo?: string | string[]
    lti?: string | string[]
  }>
}

function getChatRedirectUrl(redirectTo: string | undefined) {
  if (!redirectTo) return undefined

  const chatBaseUrl = process.env.NEXT_PUBLIC_CHAT_URL
    ? process.env.NEXT_PUBLIC_CHAT_URL.replace(/\/$/, '')
    : 'https://chat.klicker.uzh.ch'

  try {
    const chatUrl = new URL(chatBaseUrl)
    const redirectUrl = new URL(redirectTo, chatUrl)

    if (redirectUrl.origin !== chatUrl.origin) return undefined
    return redirectUrl.toString()
  } catch {
    return undefined
  }
}

export default async function Page({ searchParams }: NoLoginPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const redirectToParam = resolvedSearchParams.redirectTo
  const redirectTo = Array.isArray(redirectToParam)
    ? redirectToParam[0]
    : redirectToParam
  const ltiParam = resolvedSearchParams.lti
  const isLtiContext =
    (Array.isArray(ltiParam) ? ltiParam[0] : ltiParam) === '1'

  const loginBaseUrl = process.env.NEXT_PUBLIC_PWA_URL
    ? process.env.NEXT_PUBLIC_PWA_URL.replace(/\/$/, '')
    : 'https://pwa.klicker.uzh.ch'
  const redirectUrl = getChatRedirectUrl(redirectTo)

  const loginHref = redirectUrl
    ? `${loginBaseUrl}/login?redirect_to=${encodeURIComponent(redirectUrl)}`
    : `${loginBaseUrl}/login`

  return (
    <div
      data-cy="chat-no-login"
      className="bg-muted flex min-h-screen w-full items-center justify-center px-4"
    >
      <NoLoginSelfHeal redirectTo={redirectTo} />
      <div className="bg-card w-full max-w-lg rounded-lg border p-8 text-center shadow-sm">
        <h1
          data-cy="chat-no-login-title"
          className="text-foreground text-2xl font-semibold"
        >
          Login Required
        </h1>
        {isLtiContext ? (
          <>
            <p className="text-muted-foreground mt-4 text-base">
              Your LTI session could not be verified. The link may have expired
              or be invalid.
            </p>
            <p className="text-muted-foreground mt-2 text-sm">
              Please return to your LMS and re-launch the chatbot, or sign in
              with a KlickerUZH account.
            </p>
          </>
        ) : (
          <p className="text-muted-foreground mt-4 text-base">
            You need to create a KlickerUZH account or log in before you can
            access this chatbot.
          </p>
        )}
        {redirectUrl && (
          <p className="text-muted-foreground mt-2 text-sm">
            After logging in, return to{' '}
            <span className="font-medium">{redirectUrl}</span> to continue your
            conversation.
          </p>
        )}
        <Link
          data-cy="chat-no-login-link"
          href={loginHref}
          className="bg-uzh-blue hover:bg-uzh-blue-80 focus-visible:outline-uzh-blue-40 mt-8 inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-base font-semibold text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          prefetch={false}
        >
          Go to KlickerUZH Login
        </Link>
      </div>
    </div>
  )
}
