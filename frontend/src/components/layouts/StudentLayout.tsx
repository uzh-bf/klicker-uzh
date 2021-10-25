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

  let activeQuestionItem = {
    href: 'activeQuestion',
    label: <FormattedMessage defaultMessage="Active Question" id="joinSession.sidebar.activeQuestion" />,
    name: 'activeQuestion',
    unseenItems: 0,
  }
  let feedbackChannelItem = {
    href: 'feedbackChannel',
    label: <FormattedMessage defaultMessage="Feedback-Channel" id="joinSession.sidebar.feedbackChannel" />,
    name: 'feedbackChannel',
    unseenItems: 0,
  }

  const [totalCount, setTotalCount] = useState(0)
  const [sidebarItems, setSidebarItems] = useState(
    isInteractionEnabled ? [activeQuestionItem, feedbackChannelItem] : [activeQuestionItem]
  )

  useEffect(() => {
    activeQuestionItem.unseenItems = questionIds.length
    feedbackChannelItem.unseenItems = feedbackIds.length
    setSidebarItems(isInteractionEnabled ? [activeQuestionItem, feedbackChannelItem] : [activeQuestionItem])
    setTotalCount(
      sidebarItems
        .map((item: any) => item.unseenItems)
        .reduce((previousValue: number, currentValue: number) => previousValue + currentValue)
    )
  }, [questionIds])

  useEffect(() => {
    activeQuestionItem.unseenItems = questionIds.length
    feedbackChannelItem.unseenItems = feedbackIds.length
    setSidebarItems(isInteractionEnabled ? [activeQuestionItem, feedbackChannelItem] : [activeQuestionItem])
    setTotalCount(
      sidebarItems
        .map((item: any) => item.unseenItems)
        .reduce((previousValue: number, currentValue: number) => previousValue + currentValue)
    )
  }, [feedbackIds])

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
            {isInteractionEnabled && totalCount < 10 && totalCount > 0 && (
              <div className="absolute z-10 w-5 h-5 rounded-xl text-white text-sm text-center bg-red-600 right-0 top-0.5">
                {totalCount}
              </div>
            )}
            {isInteractionEnabled && totalCount > 9 && (
              <div className="absolute right-0 pt-[0.1rem] z-10 w-5 h-5 text-xs text-center text-white bg-red-600 rounded-xl top-0.5">
                9+
              </div>
            )}
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
