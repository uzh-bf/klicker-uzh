import { faCommentDots } from '@fortawesome/free-regular-svg-icons'
import { faQuestion, faRankingStar } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Head from 'next/head'
import React from 'react'
import { twMerge } from 'tailwind-merge'

import MobileMenuBar from './common/MobileMenuBar'

interface LayoutProps {
  children: React.ReactNode
  displayName: string
  isFeedbackAreaVisible: boolean
  isGamificationEnabled: boolean
  setActiveMobilePage: (value: string) => void
  className?: string
}

function Layout({
  children,
  displayName,
  isFeedbackAreaVisible,
  isGamificationEnabled,
  setActiveMobilePage,
  className,
}: LayoutProps) {
  const mobileMenuItems = [
    {
      value: 'questions',
      label: 'Questions',
      icon: <FontAwesomeIcon icon={faQuestion} size="lg" />,
    },
  ]

  if (isFeedbackAreaVisible) {
    mobileMenuItems.push({
      value: 'feedbacks',
      label: 'Feedback',
      icon: <FontAwesomeIcon icon={faCommentDots} size="lg" />,
    })
  }
  if (isGamificationEnabled) {
    mobileMenuItems.push({
      value: 'leaderboard',
      label: 'Leaderboard',
      icon: <FontAwesomeIcon icon={faRankingStar} size="lg" />,
    })
  }

  return (
    <div className="w-full h-full md:p-1.5 bg-uzh-grey-60">
      <Head>
        <title>Live Session</title>
        <meta
          name="description"
          content={'Live Session ' + displayName}
          charSet="utf-8"
        ></meta>
      </Head>

      <div
        className={twMerge(
          'absolute flex flex-row top-0 left-0 right-0 md:p-1.5 overflow-auto gap-1.5',
          'bg-white md:bg-uzh-grey-60 md:overflow-scroll min-h-screen h-max',
          (isFeedbackAreaVisible || isGamificationEnabled) &&
            'bottom-16 md:bottom-0'
        )}
      >
        {children}
        {mobileMenuItems.length > 1 && (
          <div className="absolute bottom-0 w-full h-16 md:hidden">
            <MobileMenuBar
              menuItems={mobileMenuItems}
              onClick={setActiveMobilePage}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default Layout
