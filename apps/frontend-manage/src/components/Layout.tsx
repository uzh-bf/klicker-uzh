import { useQuery } from '@apollo/client'
import { UserProfileDocument } from '@klicker-uzh/graphql/dist/ops'
import Head from 'next/head'
import { useRouter } from 'next/router'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import Footer from './common/Footer'
import Header from './common/Header'

interface LayoutProps {
  displayName: string
  children: React.ReactNode
  className?: string
  scrollable?: boolean
}

const defaultProps = {
  displayName: 'KlickerUZH',
  className: '',
  scrollable: true,
}

function Layout({ displayName, children, className, scrollable }: LayoutProps) {
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
    <div className="flex flex-col w-full h-full">
      <Head>
        <title>{displayName}</title>
        <meta name="description" content={displayName} charSet="utf-8"></meta>
      </Head>

      <div className={twMerge('h-full overflow-y-none', className)}>
        <div className="fixed top-0 z-10 w-full print:hidden">
          <Header user={dataUser.userProfile} />
        </div>
        <div
          className={twMerge(
            'flex justify-between flex-col mt-14 [height:_calc(100%-3.5rem)]',
            scrollable ? 'overflow-y-auto' : ''
          )}
        >
          <div className="p-4">{children}</div>
          <Footer className="relative" />
        </div>
      </div>
    </div>
  )
}

Layout.defaultProps = defaultProps
export default Layout
