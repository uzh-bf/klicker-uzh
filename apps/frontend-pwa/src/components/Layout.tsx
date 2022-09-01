import { faArrowsRotate, faBars } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import React, { useEffect, useState } from 'react'
import { Icon } from 'semantic-ui-react'

// TODO: move NotificationBadge to design system?
// import NotificationBadge from '../common/NotificationBadge'

interface LayoutProps {
  children: React.ReactNode
  isAuthenticationEnabled?: boolean
  isInteractionEnabled?: boolean
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
}

function Layout({
  children,
  isAuthenticationEnabled,
  isInteractionEnabled,
  sidebar,
  title,
  questionIds,
  feedbackIds,
  responseIds,
  subscribeToMore,
}: LayoutProps): React.ReactElement {
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
    const unseenQuestionCount = questionIds.filter(
      (questionId: string) => !sessionStorage?.getItem(questionId)
    ).length
    const unseenFeedbackCount = feedbackIds.filter(
      (feedbackId: string) => !sessionStorage?.getItem(feedbackId)
    ).length
    const unseenResponseCount = responseIds.filter(
      (responseId: string) => !sessionStorage?.getItem(responseId)
    ).length
    setUnseenQuestions(unseenQuestionCount)
    setUnseenFeedbacks(unseenFeedbackCount + unseenResponseCount)
    setTotalUnseenCount(
      unseenQuestionCount + unseenFeedbackCount + unseenResponseCount
    )
  }, [questionIds, feedbackIds, responseIds])

  return (
    <div>
      <div className="flex flex-col min-h-full">
        <div className="border-0 !border-b border-solid border-gray-300  flex justify-between flex-initial p-[0.3rem] items-center md:!hidden">
          <div className="relative h-10 mt-0 w-11">
            <Button
              active={sidebar.sidebarVisible}
              className="justify-center w-10 h-10"
              disabled={!isInteractionEnabled}
              onClick={sidebar.handleToggleSidebarVisible}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faBars} />
              </Button.Icon>
            </Button>
            {isInteractionEnabled && (
              <NotificationBadge count={totalUnseenCount} />
            )}
          </div>

          <h1 className="m-0 !text-lg">
            {isAuthenticationEnabled && <Icon color="green" name="lock" />}{' '}
            {title}
          </h1>
          <Button
            className="justify-center w-10 h-10"
            onClick={(): void => window.location.reload()}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faArrowsRotate} />
            </Button.Icon>
          </Button>
        </div>

        <div className="flex flex-1">
          {/* // TODO: replace sidebar with menubar at the bottom for mobile devices
           <Sidebar
            items={[
              <SidebarItem
                active={sidebar.activeItem === 'activeQuestion'}
                handleSidebarItemClick={sidebar.handleSidebarActiveItemChange(
                  'activeQuestion'
                )}
                icon="question"
                key="activeQuestion"
                name="activeQuestion"
                unseenItems={unseenQuestions}
              >
                Active Question
              </SidebarItem>,
              isInteractionEnabled && (
                <SidebarItem
                  active={sidebar.activeItem === 'feedbackChannel'}
                  handleSidebarItemClick={sidebar.handleSidebarActiveItemChange(
                    'feedbackChannel'
                  )}
                  icon="talk"
                  key="feedbackChannel"
                  name="feedbackChannel"
                  unseenItems={unseenFeedbacks}
                >
                  Feedback-Channel
                </SidebarItem>
              ),
            ].filter(Boolean)}
            visible={sidebar.sidebarVisible}
          >
            {children}
          </Sidebar> */}
        </div>
      </div>
    </div>
  )
}

Layout.defaultProps = defaultProps

export default Layout
