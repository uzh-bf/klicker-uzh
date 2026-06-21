import { trpc } from '@lib/trpc'
import Head from 'next/head'
import React, { Dispatch, SetStateAction } from 'react'
import { twMerge } from 'tailwind-merge'
import Header from './common/Header'

import MobileMenuBar from './common/MobileMenuBar'

export const LAYOUT_SCROLL_CONTAINER_ID = 'layout-scroll-container'

type LayoutCourse = {
  color?: string | null
  displayName?: string | null
  id?: string | null
  name?: string | null
}

interface LayoutProps {
  children?: React.ReactNode
  displayName?: string
  embedded?: boolean
  course?: LayoutCourse
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
  const participantSelfInput = liveQuizId ? { liveQuizId } : undefined
  const { data: dataParticipant } = trpc.participant.self.useQuery(
    participantSelfInput,
    { enabled: !embedded }
  )

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
              (dataParticipant.self.role === 'PARTICIPANT' || liveQuizId)
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
              dataParticipant.self.role === 'TEMPORARY_PARTICIPANT'
            }
          />
        </div>
      )}
    </>
  )
}

export default Layout
