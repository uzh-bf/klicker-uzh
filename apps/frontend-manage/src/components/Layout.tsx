import { useQuery } from '@apollo/client'
import { UserProfileDocument } from '@klicker-uzh/graphql/dist/ops'
import Head from 'next/head'
import { useRouter } from 'next/router'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import Header from './common/Header'

interface LayoutProps {
  children: React.ReactNode
  className?: string
}

const defaultProps = {
  className: '',
}

function Layout({ children, className }: LayoutProps) {
  const {
    loading: loadingUser,
    error: errorUser,
    data: dataUser,
  } = useQuery(UserProfileDocument)

  const router = useRouter()

  console.log(dataUser)

  if (!dataUser && !loadingUser) {
    router.push('/login')
  }

  return (
    <div className="w-full h-full">
      <Head>
        <title>// TODO</title>
        <meta name="description" content="// TODO" charSet="utf-8"></meta>
      </Head>

      <div
        className={twMerge(
          'md:flex md:flex-row md:pt-16 md:pb-1.5 md:px-1.5 md:gap-1.5 md:bg-uzh-grey-60 pt-16 pb-16 md:h-screen',
          className
        )}
      >
        <div className="md:-mx-1.5 fixed top-0 z-10 w-full h-14">
          <Header user={dataUser?.userProfile || undefined} />
        </div>
        {children}
      </div>
    </div>
  )
}

Layout.defaultProps = defaultProps
export default Layout
