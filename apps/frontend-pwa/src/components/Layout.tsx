import { useQuery } from '@apollo/client'
import {
  type Course,
  SelfDocument,
  type StudentCourse,
  UserRole,
} from '@klicker-uzh/graphql/dist/ops'
import Head from 'next/head'
import { useTranslations } from 'next-intl'
import type React from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { twMerge } from 'tailwind-merge'
import Header from './common/Header'

import MobileMenuBar from './common/MobileMenuBar'

export const LAYOUT_SCROLL_CONTAINER_ID = 'layout-scroll-container'

interface LayoutProps {
  children?: React.ReactNode
  displayName?: string
  embedded?: boolean
  embeddedAutoResize?: boolean
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
  activeMobilePage?: string
  liveQuizId?: string
  className?: { header?: string; body?: string }
}

function Layout({
  children,
  displayName = 'KlickerUZH',
  embedded = false,
  embeddedAutoResize = false,
  course,
  mobileMenuItems,
  setActiveMobilePage,
  activeMobilePage,
  liveQuizId,
  className,
}: LayoutProps) {
  const t = useTranslations()
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

      <a
        href={`#${LAYOUT_SCROLL_CONTAINER_ID}`}
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-3 focus:text-slate-900 focus:ring-2"
      >
        {t('shared.generic.skipToContent')}
      </a>

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

      <main
        id={LAYOUT_SCROLL_CONTAINER_ID}
        tabIndex={-1}
        className={twMerge(
          embeddedAutoResize
            ? 'flex flex-none flex-col overflow-visible'
            : 'flex min-h-0 flex-1 flex-col overflow-y-auto',
          embedded ? 'p-0' : 'p-4',
          !embedded && pageInFrame && 'px-0',
          className?.body
        )}
      >
        {children}
      </main>

      {!embedded && (
        <div className="flex-none md:hidden">
          <MobileMenuBar
            menuItems={mobileMenuItems}
            activeValue={activeMobilePage}
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
