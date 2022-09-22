import { useQuery } from '@apollo/client'
import { SelfDocument } from '@klicker-uzh/graphql/dist/ops'
import Head from 'next/head'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import Header from './common/Header'

import MobileMenuBar from './common/MobileMenuBar'

interface LayoutProps {
  children: React.ReactNode
  displayName?: string
  courseName?: string
  courseColor?: string | null
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
  courseColor: undefined,
  mobileMenuItems: undefined,
  className: '',
  pageNotFound: false,
}

function Layout({
  children,
  displayName,
  courseName,
  courseColor,
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
    <div className="flex flex-col w-full h-full">
      <Head>
        <title>{`Live Session - ${displayName}`}</title>
        <meta
          name="description"
          content={`Live Session - ${displayName}`}
          charSet="utf-8"
        ></meta>
      </Head>

      <div className={twMerge('pt-16 pb-16 md:pb-0', className)}>
        <div className="fixed top-0 z-10 w-full">
          <Header
            participant={dataParticipant?.self || undefined}
            title={displayName}
            courseName={courseName}
            courseColor={courseColor}
          />
        </div>

        <div className="flex flex-col p-4">{children}</div>

        <div className="fixed bottom-0 w-full h-14 md:hidden">
          <MobileMenuBar
            menuItems={mobileMenuItems}
            onClick={setActiveMobilePage}
            participantMissing={!dataParticipant?.self}
          />
        </div>
      </div>
    </div>
  )
}

Layout.defaultProps = defaultProps
export default Layout
