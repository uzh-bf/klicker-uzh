import { useQuery } from '@apollo/client'
import { UserProfileDocument } from '@klicker-uzh/graphql/dist/ops'
import Footer from '@klicker-uzh/shared-components/src/Footer'
import Head from 'next/head'
import { useRouter } from 'next/router'
import React from 'react'
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
  const router = useRouter()

  const {
    loading: loadingUser,
    error: errorUser,
    data: dataUser,
  } = useQuery(UserProfileDocument)

  if (!dataUser && !loadingUser) {
    router.push('/login')
  }
  if (!dataUser) {
    return <div>Loading...</div>
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
          'flex-1 flex flex-col md:overflow-y-auto p-4',
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
