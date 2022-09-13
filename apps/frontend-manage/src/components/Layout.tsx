import { useQuery } from '@apollo/client'
import { UserProfileDocument } from '@klicker-uzh/graphql/dist/ops'
import Head from 'next/head'
import { useRouter } from 'next/router'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import Header from './common/Header'

interface LayoutProps {
  displayName: string
  children: React.ReactNode
  title?: string
  className?: string
}

const defaultProps = {
  title: 'KlickerUZH',
  className: '',
}

function Layout({ displayName, children, title, className }: LayoutProps) {
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
        <title>{title}</title>
        <meta name="description" content={title} charSet="utf-8"></meta>
      </Head>

      <div
        className={twMerge(
          'md:flex md:flex-row md:gap-1.5 pt-16 pb-16 md:h-screen',
          className
        )}
      >
        <div className="fixed top-0 z-10 w-full h-14">
          <Header
            user={dataUser.userProfile || undefined}
            displayName={displayName}
          />
        </div>
        <div className="px-4 py-2">{children}</div>
      </div>
    </div>
  )
}

Layout.defaultProps = defaultProps
export default Layout
