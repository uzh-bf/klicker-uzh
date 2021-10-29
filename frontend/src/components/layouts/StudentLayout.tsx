import React, { useEffect, useState } from 'react'
import { FormattedMessage } from 'react-intl'
import { Button, Icon } from 'semantic-ui-react'

import CommonLayout from './CommonLayout'
import Sidebar from '../common/sidebar/Sidebar'

interface Props {
  children: React.ReactNode
  isAuthenticationEnabled?: boolean
  isInteractionEnabled?: boolean
  pageTitle?: string
  sidebar: any
  subscribeToMore: () => void
  title: string
  questionIds: any
  feedbackIds?: any
}

const defaultProps = {
  isAuthenticationEnabled: false,
  isInteractionEnabled: false,
  pageTitle: 'StudentLayout',
}

function StudentLayout({
  children,
  isAuthenticationEnabled,
  isInteractionEnabled,
  pageTitle,
  sidebar,
  title,
  questionIds,
  feedbackIds,
  subscribeToMore,
}: Props): React.ReactElement {
  useEffect((): void => {
    subscribeToMore()
  }, [])

  const activeQuestionItem = {
    href: 'activeQuestion',
    label: <FormattedMessage defaultMessage="Active Question" id="joinSession.sidebar.activeQuestion" />,
    name: 'activeQuestion',
  }

  const feedbackChannelItem = {
    href: 'feedbackChannel',
    label: <FormattedMessage defaultMessage="Feedback-Channel" id="joinSession.sidebar.feedbackChannel" />,
    name: 'feedbackChannel',
  }

  const [totalCount, setTotalCount] = useState(0)
  const [sidebarItems, setSidebarItems] = useState(
    isInteractionEnabled ? [activeQuestionItem, feedbackChannelItem] : [activeQuestionItem]
  )

  const [unseenQuestions, setUnseenQuestions] = useState(0)
  const [unseenFeedbacks, setUnseenFeedbacks] = useState(0)

  useEffect(() => {
    if (sidebar.activeItem == 'activeQuestion' && questionIds) {
      questionIds.map((questionId: string) => {
        sessionStorage.setItem(questionId, 'true')
      })
    } else if (feedbackIds) {
      feedbackIds.map((feedbackId: string) => {
        sessionStorage.setItem(feedbackId, 'true')
      })
    }
  })

  useEffect(() => {
    setUnseenQuestions(questionIds.filter((questionId: string) => sessionStorage.getItem(questionId) !== 'true').length)
    setUnseenFeedbacks(feedbackIds.length)
    setTotalCount(
      questionIds.filter((questionId: string) => sessionStorage.getItem(questionId) !== 'true').length +
        feedbackIds.length
    )
  }, [questionIds, feedbackIds])

  const NotificationBadge = ({ count, interactionEnabled }) => {
    if (interactionEnabled && count < 10 && count > 0) {
      return (
        <div className="absolute z-10 w-5 h-5 rounded-xl text-white text-sm text-center bg-red-600 right-0 top-0.5">
          {count}
        </div>
      )
    } else if (interactionEnabled && count > 9) {
      return (
        <div className="absolute right-0 pt-[0.1rem] z-10 w-5 h-5 text-xs text-center text-white bg-red-600 rounded-xl top-0.5">
          9+
        </div>
      )
    }
    return <></>
  }

  return (
    <CommonLayout baseFontSize="16px" nextHeight="100%" pageTitle={pageTitle}>
      <div className="studentLayout">
        <div className="header">
          <div className="relative h-10 mt-0 w-11">
            <Button
              basic
              active={sidebar.sidebarVisible}
              disabled={sidebarItems.length === 1}
              icon="content"
              onClick={sidebar.handleToggleSidebarVisible}
              className="absolute z-0"
            />
            <NotificationBadge count={totalCount} interactionEnabled={isInteractionEnabled} />
          </div>

          <h1 className="pageTitle">
            {isAuthenticationEnabled && <Icon color="green" name="lock" />} {title}
          </h1>
          <Button basic icon="refresh" onClick={(): void => window.location.reload()} />
        </div>

        <div className="content">
          <Sidebar
            activeItem={sidebar.activeItem}
            handleSidebarItemClick={sidebar.handleSidebarActiveItemChange}
            items={sidebarItems}
            visible={sidebar.sidebarVisible}
            unseenQuestions={unseenQuestions}
            unseenFeedbacks={unseenFeedbacks}
          >
            {children}
          </Sidebar>
        </div>

        <style jsx>
          {`
            @import 'src/theme';

            .studentLayout {
              display: flex;
              flex-direction: column;

              min-height: 100%;

              .header {
                flex: 0 0 auto;

                display: flex;
                justify-content: space-between;

                align-items: center;

                border-bottom: 1px solid lightgrey;
                padding: 0.3rem;

                :global(button) {
                  margin: 0;
                }
              }

              .pageTitle {
                font-size: 1.1rem !important;
                margin: 0;
              }

              .content {
                flex: 1;

                display: flex;
              }

              @include desktop-tablet-only {
                .header {
                  display: none;
                }
              }
            }
          `}
        </style>
      </div>
    </CommonLayout>
  )
}

StudentLayout.defaultProps = defaultProps

export default StudentLayout
