import { useQuery } from '@apollo/client'
import { User, UserProfileDocument } from '@klicker-uzh/graphql/dist/ops'
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
}

const defaultProps = {
  displayName: 'KlickerUZH',
  className: '',
}

function Layout({ displayName, children, className }: LayoutProps) {
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
    <div className="w-full h-full">
      <Head>
        <title>{displayName}</title>
        <meta name="description" content={displayName} charSet="utf-8"></meta>
      </Head>

      <div className={twMerge('pt-16 h-screen relative', className)}>
        <div className="fixed top-0 z-10 w-full h-14">
          <Header user={dataUser.userProfile as User} />
        </div>
        <div className="relative min-h-full py-2">
          <div className="h-full px-4 pb-20 mx-auto max-w-screen-2xl">
            {children}
          </div>
          <Footer />
        </div>
      </div>
    </div>
  )
}

Layout.defaultProps = defaultProps
export default Layout
