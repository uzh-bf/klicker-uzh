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
import { useAiFeaturesEnabled } from '../lib/hooks/useAiFeaturesEnabled'
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

  // The assistant launcher is fixed to the bottom-right viewport corner
  // (h-14 at bottom-4, md:bottom-6), so end-of-page controls need enough
  // bottom clearance to scroll out from under it. This must be an in-flow
  // spacer element: browsers do not extend a scroll container's scrollable
  // area by its own bottom padding once content overflows.
  const assistantClearance =
    useAiFeaturesEnabled() && Boolean(process.env.NEXT_PUBLIC_CHAT_URL)

  const {
    loading: loadingUser,
    error: errorUser,
    data: dataUser,
  } = useQuery(UserProfileDocument, { fetchPolicy: 'cache-and-network' })

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
          'flex flex-1 flex-col p-4 md:overflow-y-auto',
          className?.children
        )}
        data-cy={data?.cy}
        data-test={data?.test}
      >
        {children}
        {assistantClearance ? (
          <div aria-hidden className="h-20 shrink-0 md:h-24" />
        ) : null}
      </div>
      <Footer />
    </>
  )
}

export default Layout
