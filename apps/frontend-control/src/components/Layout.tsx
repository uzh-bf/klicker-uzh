import Loader from '@klicker-uzh/shared-components/src/Loader'
import { trpc } from '@lib/trpc'
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

function Layout({ title, children, quizId, className }: LayoutProps) {
  const router = useRouter()
  const {
    isLoading: loadingUser,
    error: errorUser,
    data: dataUser,
  } = trpc.user.profile.useQuery()
  const shouldRedirectToLogin =
    !dataUser && (!loadingUser || Boolean(errorUser))

  useEffect(() => {
    if (!shouldRedirectToLogin) return

    void router.push('/login')
  }, [router, shouldRedirectToLogin])

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
