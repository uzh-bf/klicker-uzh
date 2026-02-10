import Link from 'next/link'

interface NoLoginPageProps {
  searchParams?: Promise<{ redirectTo?: string | string[]; lti?: string }>
}

export default async function Page({ searchParams }: NoLoginPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const redirectToParam = resolvedSearchParams.redirectTo
  const redirectTo = Array.isArray(redirectToParam)
    ? redirectToParam[0]
    : redirectToParam
  const isLtiContext = resolvedSearchParams.lti === '1'

  const loginBaseUrl = process.env.NEXT_PUBLIC_PWA_URL
    ? process.env.NEXT_PUBLIC_PWA_URL.replace(/\/$/, '')
    : 'https://pwa.klicker.uzh.ch'

  const loginHref = redirectTo
    ? `${loginBaseUrl}/login?redirect_to=${encodeURIComponent(redirectTo)}`
    : `${loginBaseUrl}/login`

  return (
    <div className="bg-muted flex min-h-screen w-full items-center justify-center px-4">
      <div className="bg-card w-full max-w-lg rounded-lg border p-8 text-center shadow-sm">
        <h1 className="text-foreground text-2xl font-semibold">
          Login Required
        </h1>
        {isLtiContext ? (
          <>
            <p className="text-muted-foreground mt-4 text-base">
              Your LTI session could not be verified. The link may have expired
              or be invalid.
            </p>
            <p className="text-muted-foreground mt-2 text-sm">
              Please return to your LMS and re-launch the chatbot, or create a
              KlickerUZH account to access it directly.
            </p>
          </>
        ) : (
          <p className="text-muted-foreground mt-4 text-base">
            You need to create a KlickerUZH account or log in before you can
            access this chatbot.
          </p>
        )}
        {redirectTo && (
          <p className="text-muted-foreground mt-2 text-sm">
            After logging in, return to{' '}
            <span className="font-medium">{redirectTo}</span> to continue your
            conversation.
          </p>
        )}
        <Link
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
