import { useQuery } from '@apollo/client'
import {
  Course,
  SelfDocument,
  StudentCourse,
  UserRole,
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
  liveQuizId?: string
  className?: { header?: string; body?: string }
}

function Layout({
  children,
  displayName = 'KlickerUZH',
  course,
  mobileMenuItems,
  setActiveMobilePage,
  liveQuizId,
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

      <div className={twMerge('flex-none', className?.header)}>
        <Header
          participant={
            dataParticipant?.self &&
            (dataParticipant.self.role === UserRole.Participant || liveQuizId)
              ? dataParticipant.self
              : undefined
          }
          title={displayName}
          course={course}
          liveQuizId={liveQuizId}
        />
      </div>

      <div
        className={twMerge(
          'flex min-h-0 flex-1 flex-col overflow-y-auto p-4',
          pageInFrame && 'px-0',
          className?.body
        )}
      >
        {children}
      </div>

      <div className="flex-none md:hidden">
        <MobileMenuBar
          menuItems={mobileMenuItems}
          onClick={setActiveMobilePage}
          participantMissing={
            !dataParticipant?.self ||
            dataParticipant.self.role === UserRole.TemporaryParticipant
          }
        />
      </div>
    </>
  )
}

export default Layout
