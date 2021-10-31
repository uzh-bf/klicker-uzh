import React, { useEffect, useState } from 'react'
import { FormattedMessage } from 'react-intl'
import { Button, Icon } from 'semantic-ui-react'

import CommonLayout from './CommonLayout'
import Sidebar from '../common/sidebar/Sidebar'
import SidebarItem from '../common/sidebar/SidebarItem'
import NotificationBadge from '../common/NotificationBadge'

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
  responseIds?: any
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
  responseIds,
  subscribeToMore,
}: Props): React.ReactElement {
  useEffect((): void => {
    subscribeToMore()
  }, [])

  const [totalUnseenCount, setTotalUnseenCount] = useState(0)
  const [unseenQuestions, setUnseenQuestions] = useState(0)
  const [unseenFeedbacks, setUnseenFeedbacks] = useState(0)

  useEffect(() => {
    if (sidebar.activeItem === 'activeQuestion' && questionIds) {
      questionIds.forEach((questionId: string) => {
        sessionStorage?.setItem(questionId, 'true')
      })
    } else if (feedbackIds) {
      feedbackIds.forEach((feedbackId: string) => {
        sessionStorage?.setItem(feedbackId, 'true')
      })

      if (responseIds) {
        responseIds.forEach((responseId: string) => {
          sessionStorage?.setItem(responseId, 'true')
        })
      }
    }
  }, [questionIds, feedbackIds, responseIds])

  useEffect(() => {
    const unseenQuestionCount = questionIds.filter((questionId: string) => !sessionStorage?.getItem(questionId)).length
    const unseenFeedbackCount = feedbackIds.filter((feedbackId: string) => !sessionStorage?.getItem(feedbackId)).length
    const unseenResponseCount = responseIds.filter((responseId: string) => !sessionStorage?.getItem(responseId)).length
    setUnseenQuestions(unseenQuestionCount)
    setUnseenFeedbacks(unseenFeedbackCount + unseenResponseCount)
    setTotalUnseenCount(unseenQuestionCount + unseenFeedbackCount + unseenResponseCount)
  }, [questionIds, feedbackIds, responseIds])

  return (
    <CommonLayout baseFontSize="16px" nextHeight="100%" pageTitle={pageTitle}>
      <div className="studentLayout">
        <div className="header">
          <div className="relative h-10 mt-0 w-11">
            <Button
              basic
              active={sidebar.sidebarVisible}
              className="absolute z-0"
              disabled={!isInteractionEnabled}
              icon="content"
              onClick={sidebar.handleToggleSidebarVisible}
            />
            {isInteractionEnabled && <NotificationBadge count={totalUnseenCount} />}
          </div>

          <h1 className="pageTitle">
            {isAuthenticationEnabled && <Icon color="green" name="lock" />} {title}
          </h1>
          <Button basic icon="refresh" onClick={(): void => window.location.reload()} />
        </div>

        <div className="content">
          <Sidebar
            items={[
              <SidebarItem
                active={sidebar.activeItem === 'activeQuestion'}
                handleSidebarItemClick={sidebar.handleSidebarActiveItemChange('activeQuestion')}
                icon="question"
                key="activeQuestion"
                name="activeQuestion"
                unseenItems={unseenQuestions}
              >
                <FormattedMessage defaultMessage="Active Question" id="joinSession.sidebar.activeQuestion" />
              </SidebarItem>,
              isInteractionEnabled && (
                <SidebarItem
                  active={sidebar.activeItem === 'feedbackChannel'}
                  handleSidebarItemClick={sidebar.handleSidebarActiveItemChange('feedbackChannel')}
                  icon="talk"
                  key="feedbackChannel"
                  name="feedbackChannel"
                  unseenItems={unseenFeedbacks}
                >
                  <FormattedMessage defaultMessage="Feedback-Channel" id="joinSession.sidebar.feedbackChannel" />
                </SidebarItem>
              ),
            ].filter(Boolean)}
            visible={sidebar.sidebarVisible}
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
