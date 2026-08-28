import { useQuery } from '@apollo/client'
import { UserProfileDocument } from '@klicker-uzh/graphql/dist/ops'
import Footer from '@klicker-uzh/shared-components/src/Footer'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification } from '@uzh-bf/design-system'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import type React from 'react'
import { useEffect } from 'react'
import { twMerge } from 'tailwind-merge'
import Header from './common/Header'

interface LayoutProps {
  displayName?: string
  children: React.ReactNode
  className?: { root?: string; children?: string }
  data?: {
    cy?: string
    test?: string
  }
}

function Layout({
  displayName = 'KlickerUZH',
  children,
  className,
  data,
}: LayoutProps) {
  const t = useTranslations()
  const router = useRouter()

  const {
    loading: loadingUser,
    error: errorUser,
    data: dataUser,
  } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-and-network',
    // The profile is cookie-scoped; never make a server-rendered page depend on
    // a request that cannot be reused safely across users.
    ssr: false,
  })

  const redirectToLogin = !dataUser && !loadingUser

  useEffect(() => {
    if (!redirectToLogin) return

    void router.replace({
      pathname: '/login',
      query: {
        expired: 'true',
        redirect_to: router.asPath || '/',
      },
    })
  }, [redirectToLogin, router])

  if (loadingUser || redirectToLogin) {
    return (
      <div className="mx-auto my-auto">
        <Loader />
      </div>
    )
  }

  if (!dataUser || (!loadingUser && errorUser)) {
    return (
      <UserNotification type="error">
        {errorUser?.message || t('shared.generic.systemError')}
      </UserNotification>
    )
  }

  return (
    <>
      <Head>
        <title>{displayName}</title>
        <meta name="description" content={displayName} charSet="utf-8"></meta>
      </Head>

      <div className="flex-none">
        <Header user={dataUser.userProfile} />
      </div>

      <div
        className={twMerge(
          // Reserve bottom clearance so scrolled-to-end content (pagination,
          // primary submit rows) stays clear of the floating assistant
          // launcher in the bottom-right corner.
          'flex flex-1 flex-col p-4 pb-24 md:overflow-y-auto',
          className?.children
        )}
        data-cy={data?.cy}
        data-test={data?.test}
      >
        {children}
      </div>
      <Footer />
    </>
  )
}

export default Layout
