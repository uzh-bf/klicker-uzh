import { useQuery } from '@apollo/client'
import { SelfDocument } from '@klicker-uzh/graphql/dist/ops'
import Head from 'next/head'
import Link from 'next/link'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import Header from './common/Header'

import MobileMenuBar from './common/MobileMenuBar'

interface LayoutProps {
  children: React.ReactNode
  displayName?: string
  courseName?: string
  mobileMenuItems?: {
    icon: React.ReactElement
    label: string
    value: string
    unseenItems?: number
    showBadge?: boolean
  }[]
  pageNotFound?: boolean
  setActiveMobilePage?: (value: string) => void
  className?: string
}

const defaultProps = {
  displayName: 'KlickerUZH',
  courseName: undefined,
  mobileMenuItems: undefined,
  className: '',
  pageNotFound: false,
}

function Layout({
  children,
  displayName,
  courseName,
  mobileMenuItems,
  pageNotFound,
  setActiveMobilePage,
  className,
}: LayoutProps) {
  const {
    loading: loadingParticipant,
    error: errorParticipant,
    data: dataParticipant,
  } = useQuery(SelfDocument)

  return (
    <div className="w-full h-full">
      <Head>
        <title>{`Live Session - ${displayName}`}</title>
        <meta
          name="description"
          content={`Live Session - ${displayName}`}
          charSet="utf-8"
        ></meta>
      </Head>

      <div
        className={twMerge(
          'md:flex md:flex-row md:pt-16 md:pb-1.5 md:px-1.5 md:gap-1.5 pt-16 pb-16 md:h-screen',
          pageNotFound && 'h-full',
          className
        )}
      >
        <div className="md:-mx-1.5 fixed top-0 z-10 w-full h-14">
          <Header
            participant={dataParticipant?.self || undefined}
            title={displayName}
            courseName={courseName}
          />
        </div>
        {pageNotFound ? (
          <div className="flex flex-col justify-center w-full h-full p-4 text-center bg-white md:rounded-lg md:border-2 md:border-solid md:border-uzh-blue-40">
            <div className="max-w-full px-8 py-3 m-auto bg-red-200 border border-red-600 border-solid rounded-lg">
              <div>Error 404: There is nothing to see here</div>
              {dataParticipant ? (
                <div>
                  Sehen Sie sich eine{' '}
                  <Link href="/">
                    <a className="text-uzh-blue-60 hover:text-uzh-blue-100">
                      Übersicht
                    </a>
                  </Link>{' '}
                  aller Klicker-Elemente Ihrer Kurse an.
                </div>
              ) : (
                <div>
                  Sie können sich{' '}
                  <Link href="/login">
                    <a className="text-uzh-blue-60 hover:text-uzh-blue-100">
                      anmelden
                    </a>
                  </Link>
                  , um eine Übersicht aller Klicker-Elemente Ihrer Kurse zu
                  sehen.
                </div>
              )}
            </div>
          </div>
        ) : (
          children
        )}
        <div className="fixed bottom-0 w-full h-14 md:hidden">
          <MobileMenuBar
            menuItems={mobileMenuItems}
            onClick={setActiveMobilePage}
            participantMissing={!dataParticipant}
          />
        </div>
      </div>
    </div>
  )
}

Layout.defaultProps = defaultProps
export default Layout
