import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage } from 'react-intl'
import { Button } from 'semantic-ui-react'

import { CommonLayout } from '.'
import { Sidebar } from '../common/sidebar'

const propTypes = {
  children: PropTypes.node.isRequired,
  isInteractionEnabled: PropTypes.bool,
  pageTitle: PropTypes.string,
  sidebar: PropTypes.shape(Sidebar.propTypes).isRequired,
  title: PropTypes.string.isRequired,
}

const defaultProps = {
  isInteractionEnabled: false,
  pageTitle: 'StudentLayout',
}

const StudentLayout = ({
  children, isInteractionEnabled, pageTitle, sidebar, title,
}) => {
  const activeQuestionItem = {
    href: 'activeQuestion',
    label: (
      <FormattedMessage defaultMessage="Active Question" id="joinSessionsidebar.activeQuestion" />
    ),
    name: 'activeQuestion',
  }
  const feedbackChannelItem = {
    href: 'feedbackChannel',
    label: (
      <FormattedMessage defaultMessage="Feedback-Channel" id="joinSessionsidebar.feedbackChannel" />
    ),
    name: 'feedbackChannel',
  }

  const sidebarItems = isInteractionEnabled
    ? [activeQuestionItem, feedbackChannelItem]
    : [activeQuestionItem]

  return (
    <CommonLayout baseFontSize="16px" nextMinHeight="100vh" pageTitle={pageTitle}>
      <div className="studentLayout">
        <div className="header">
          <Button
            basic
            active={sidebar.sidebarVisible}
            icon="content"
            onClick={sidebar.handleToggleSidebarVisible}
          />
          <h1>{title}</h1>
          <Button
            basic
            disabled={sidebar.activeItem !== 'activeQuestion'}
            icon="refresh"
            onClick={() => window.location.reload()}
          />
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

        <style jsx>{`
          @import 'src/theme';

          .studentLayout {
            display: flex;
            flex-direction: column;

            height: 100%;
            min-height: 100vh;

            .header {
              flex: 0 0 auto;

              display: flex;
              justify-content: space-between;

              align-items: center;

              border-bottom: 1px solid lightgrey;
              padding: 0.5rem;
            }

            .header > h1 {
              font-size: 1.5rem;
              margin: 0;
              margin-left: 1rem;
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
        `}</style>
      </div>
    </CommonLayout>
  )
}

StudentLayout.propTypes = propTypes
StudentLayout.defaultProps = defaultProps

export default StudentLayout
