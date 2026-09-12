import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

interface NoLoginPageProps {
  searchParams?: Promise<{ redirectTo?: string | string[] }>
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

  const loginBaseUrl = process.env.NEXT_PUBLIC_PWA_URL
    ? process.env.NEXT_PUBLIC_PWA_URL.replace(/\/$/, '')
    : 'https://pwa.klicker.uzh.ch'
  const redirectUrl = getChatRedirectUrl(redirectTo)
  const t = await getTranslations()

  const loginHref = redirectUrl
    ? `${loginBaseUrl}/login?redirect_to=${encodeURIComponent(redirectUrl)}`
    : `${loginBaseUrl}/login`

  return (
    <main
      id="main-content"
      tabIndex={-1}
      data-cy="chat-no-login"
      className="bg-muted flex min-h-screen w-full items-center justify-center px-4"
    >
      <div className="bg-card w-full max-w-lg rounded-lg border p-8 text-center shadow-sm">
        <h1
          data-cy="chat-no-login-title"
          className="text-foreground text-2xl font-semibold"
        >
          {t('chat.noLogin.title')}
        </h1>
        <p className="text-muted-foreground mt-4 text-base">
          {t('chat.noLogin.message')}
        </p>
        {redirectUrl && (
          <p className="text-muted-foreground mt-2 text-sm">
            {t('chat.noLogin.redirectNotice')}
          </p>
        )}
        <Link
          data-cy="chat-no-login-link"
          href={loginHref}
          className="bg-primary hover:bg-primary/90 focus-visible:outline-primary/40 mt-8 inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-base font-semibold text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          prefetch={false}
        >
          {t('chat.noLogin.loginButton')}
        </Link>
      </div>
    </main>
  )
}
