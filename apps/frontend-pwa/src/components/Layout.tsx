import { useQuery } from '@apollo/client'
import {
  Course,
  SelfDocument,
  StudentCourse,
} from '@klicker-uzh/graphql/dist/ops'
import Head from 'next/head'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import Header from './common/Header'

import MobileMenuBar from './common/MobileMenuBar'

interface LayoutProps {
  children?: React.ReactNode
  displayName?: string
  course?:
    | Partial<Omit<Course, 'awards' | 'owner' | 'groupActivities'>>
    | (Omit<StudentCourse, 'owner'> & { owner: { shortname: string } })
  mobileMenuItems?: {
    icon: React.ReactElement
    label: string
    value: string
    unseenItems?: number
    showBadge?: boolean
    data?: { cy?: string; test?: string }
  }[]
  setActiveMobilePage?: (value: string) => void
  className?: string
}

function Layout({
  children,
  displayName = 'KlickerUZH',
  course,
  mobileMenuItems,
  setActiveMobilePage,
  className,
}: LayoutProps) {
  const { data: dataParticipant } = useQuery(SelfDocument)

  const pageInFrame =
    global?.window &&
    global?.window?.location !== global?.window?.parent.location

  return (
    <>
      <Head>
        <title>
          {course?.displayName
            ? `${course?.displayName} - ${displayName}`
            : displayName}
        </title>
        <meta
          name="description"
          content={
            course?.displayName
              ? `${course?.displayName} - ${displayName}`
              : displayName
          }
          charSet="utf-8"
        ></meta>
      </Head>

      <div className="flex-none">
        <Header
          participant={dataParticipant?.self || undefined}
          title={displayName}
          course={course}
        />
      </div>

      <div
        className={twMerge(
          'flex-1 flex flex-col p-4 min-h-0 overflow-y-auto',
          pageInFrame && 'px-0'
        )}
      >
        {children}
      </div>

      <div className="flex-none md:hidden">
        <MobileMenuBar
          menuItems={mobileMenuItems}
          onClick={setActiveMobilePage}
          participantMissing={!dataParticipant?.self}
        />
      </div>
    </>
  )
}

export default Layout
