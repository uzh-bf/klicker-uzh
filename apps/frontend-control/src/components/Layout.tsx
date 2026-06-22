import Loader from '@klicker-uzh/shared-components/src/Loader'
import { trpc } from '@lib/trpc'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { twMerge } from 'tailwind-merge'
import Header from './layout/Header'
import MobileMenuBar from './layout/MobileMenuBar'

interface LayoutProps {
  title: string
  children: React.ReactNode
  quizId?: string
  className?: string
}

function isUnauthorizedError(error: unknown) {
  if (!(error instanceof Error)) return false

  return (
    error.message === 'Unauthorized' ||
    (error as { data?: { code?: string } }).data?.code === 'UNAUTHORIZED'
  )
}

function Layout({ title, children, quizId, className }: LayoutProps) {
  const t = useTranslations()
  const router = useRouter()
  const {
    isLoading: loadingUser,
    error: errorUser,
    data: dataUser,
  } = trpc.user.profile.useQuery()
  const hasProfileError = Boolean(errorUser)
  const unauthorizedProfileError = isUnauthorizedError(errorUser)
  const shouldShowProfileError =
    !dataUser && hasProfileError && !unauthorizedProfileError
  const shouldRedirectToLogin =
    !dataUser &&
    !shouldShowProfileError &&
    (!loadingUser || unauthorizedProfileError)

  useEffect(() => {
    if (!shouldRedirectToLogin) return

    void router.push('/login')
  }, [router, shouldRedirectToLogin])

  if (shouldShowProfileError) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <UserNotification
          type="error"
          message={t('shared.generic.systemError')}
        />
      </div>
    )
  }

  if (!dataUser) {
    return <Loader />
  }

  return (
    <div className="flex h-full w-full flex-col">
      <Head>
        <title>KlickerUZH Controller {title}</title>
        <meta
          name="description"
          content="KlickerUZH Controller App"
          charSet="utf-8"
        ></meta>
      </Head>

      <div className={twMerge('overflow-y-none h-full', className)}>
        <div className="fixed top-0 z-10 w-full">
          <Header title={title} />
        </div>

        <div className="mb-12 mt-11 flex h-[calc(100%-5.75rem)] flex-col overflow-y-auto p-4 md:mb-0 md:h-[calc(100%-2.75rem)]">
          {children}
        </div>

        <div className="fixed bottom-0 h-12 w-full md:hidden">
          <MobileMenuBar quizId={quizId} />
        </div>
      </div>
    </div>
  )
}

export default Layout
