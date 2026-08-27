import { useQuery } from '@apollo/client'
import { faBullhorn } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Course,
  SelfDocument,
  StudentCourse,
  UserRole,
} from '@klicker-uzh/graphql/dist/ops'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import React, { Dispatch, SetStateAction, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import Header from './common/Header'
import MobileMenuBar from './common/MobileMenuBar'
import ProductUpdateFeedModal from './productUpdates/ProductUpdateFeedModal'
import { useProductUpdates } from './productUpdates/useProductUpdates'

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
  // Set by the pages on which a student works through questions at their own
  // pace. A live quiz announces itself through `liveQuizId`, but self-paced
  // answering has no such marker, and interrupting an answer with a product
  // announcement is exactly what the subsystem must not do.
  activelyAnswering?: boolean
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
  activelyAnswering = false,
  className,
}: LayoutProps) {
  const t = useTranslations()
  const router = useRouter()
  const [showProductUpdates, setShowProductUpdates] = useState(false)

  const { data: dataParticipant } = useQuery(SelfDocument, {
    variables: { liveQuizId },
    fetchPolicy: 'cache-and-network',
    skip: embedded,
  })

  const pageInFrame =
    global?.window &&
    global?.window?.location !== global?.window?.parent.location

  // Product updates reach registered participants who are reading the app, and
  // nobody else: not the assessment build, not a page embedded in a learning
  // management system, not somebody answering questions in a live quiz or at
  // their own pace, and not a temporary or anonymous participant. A suppressed
  // surface asks the backend nothing.
  const productUpdatesEnabled =
    process.env.NEXT_PUBLIC_IS_ASSESSMENT !== 'true' &&
    !embedded &&
    !pageInFrame &&
    !liveQuizId &&
    !activelyAnswering &&
    !router.pathname.startsWith('/session') &&
    dataParticipant?.self?.role === UserRole.Participant

  const { unreadCount } = useProductUpdates({
    enabled: productUpdatesEnabled,
  })

  const productUpdatesMenuItem = {
    label: t('pwa.productUpdates.menuLabel'),
    icon: <FontAwesomeIcon icon={faBullhorn} size="lg" />,
    value: 'productUpdates',
    onClick: () => setShowProductUpdates(true),
    showBadge: unreadCount > 0,
    data: { cy: 'mobile-menu-product-updates' },
  }

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
            onOpenProductUpdates={
              productUpdatesEnabled
                ? () => setShowProductUpdates(true)
                : undefined
            }
            unreadProductUpdates={unreadCount}
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
            menuItems={
              productUpdatesEnabled
                ? [...(mobileMenuItems ?? []), productUpdatesMenuItem]
                : mobileMenuItems
            }
            onClick={(value) => setActiveMobilePage?.(value as any)}
            participantMissing={
              !dataParticipant?.self ||
              dataParticipant.self.role === UserRole.TemporaryParticipant
            }
          />
        </div>
      )}

      {showProductUpdates && (
        <ProductUpdateFeedModal onClose={() => setShowProductUpdates(false)} />
      )}
    </>
  )
}

export default Layout
