import { useQuery } from '@apollo/client'
import { SelfDocument } from '@klicker-uzh/graphql/dist/ops'
import Head from 'next/head'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import MobileHeader from './common/MobileHeader'

import MobileMenuBar from './common/MobileMenuBar'

interface LayoutProps {
  children: React.ReactNode
  displayName?: string
  mobileMenuItems?: {
    icon: React.ReactElement
    label: string
    value: string
    unseenItems?: number
    showBadge?: boolean
  }[]
  setActiveMobilePage?: (value: string) => void
  className?: string
}

const defaultProps = {
  displayName: 'KlickerUZH',
  mobileMenuItems: undefined,
  className: '',
}

// TODO: fix scroll issues on mobile and (if possible) ensure that different parts of the screen (e.g. questions and feedback area) can scroll independently
function Layout({
  children,
  displayName,
  mobileMenuItems,
  setActiveMobilePage,
  className,
}: LayoutProps) {
  const {
    loading: loadingParticipant,
    error: errorParticipant,
    data: dataParticipant,
  } = useQuery(SelfDocument)

  return (
    <div className="w-full h-full md:p-1.5 bg-uzh-grey-60">
      <Head>
        <title>{displayName}</title>
        <meta name="description" content={displayName} charSet="utf-8"></meta>
      </Head>

      <div
        className={twMerge(
          'absolute flex flex-row top-0 left-0 right-0 botom-0 md:p-1.5 overflow-auto gap-1.5',
          'bg-white md:bg-uzh-grey-60 md:overflow-scroll min-h-screen h-max pt-14 bottom-14 md:bottom-0',
          className
        )}
      >
        <div className="absolute top-0 w-full h-15 md:hidden">
          <MobileHeader participant={dataParticipant?.self || undefined} />
        </div>
        {children}
        <div className="absolute bottom-0 w-full h-14 md:hidden">
          <MobileMenuBar
            menuItems={mobileMenuItems}
            onClick={setActiveMobilePage}
          />
        </div>
      </div>
    </div>
  )
}

Layout.defaultProps = defaultProps
export default Layout
