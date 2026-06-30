import { useQuery } from '@apollo/client'
import {
  Course,
  SelfDocument,
  StudentCourse,
  UserRole,
} from '@klicker-uzh/graphql/dist/ops'
import Head from 'next/head'
import React, { Dispatch, SetStateAction } from 'react'
import { twMerge } from 'tailwind-merge'
import Header from './common/Header'

import MobileMenuBar from './common/MobileMenuBar'

export const LAYOUT_SCROLL_CONTAINER_ID = 'layout-scroll-container'

interface LayoutProps {
  children?: React.ReactNode
  displayName?: string
  embedded?: boolean
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
  setActiveMobilePage?: Dispatch<
    SetStateAction<'questions' | 'feedbacks' | 'leaderboard'>
  >
  liveQuizId?: string
  className?: { header?: string; body?: string }
}

function Layout({
  children,
  displayName = 'KlickerUZH',
  embedded = false,
  course,
  mobileMenuItems,
  setActiveMobilePage,
  liveQuizId,
  className,
}: LayoutProps) {
  const { data: dataParticipant } = useQuery(SelfDocument, {
    variables: { liveQuizId },
    fetchPolicy: 'cache-and-network',
    skip: embedded,
  })

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

      {!embedded && (
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
      )}

      <div
        id={LAYOUT_SCROLL_CONTAINER_ID}
        className={twMerge(
          'flex min-h-0 flex-1 flex-col overflow-y-auto',
          embedded ? 'p-0' : 'p-4',
          !embedded && pageInFrame && 'px-0',
          className?.body
        )}
      >
        {children}
      </div>

      {!embedded && (
        <div className="flex-none md:hidden">
          <MobileMenuBar
            menuItems={mobileMenuItems}
            onClick={(value) => setActiveMobilePage?.(value as any)}
            participantMissing={
              !dataParticipant?.self ||
              dataParticipant.self.role === UserRole.TemporaryParticipant
            }
          />
        </div>
      )}
    </>
  )
}

export default Layout
