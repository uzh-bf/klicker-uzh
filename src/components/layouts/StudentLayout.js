import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage } from 'react-intl'
import { Button } from 'semantic-ui-react'
import { compose, lifecycle } from 'recompose'

import { CommonLayout } from '.'
import { Sidebar } from '../common/sidebar'

const propTypes = {
  children: PropTypes.node.isRequired,
  isInteractionEnabled: PropTypes.bool,
  pageTitle: PropTypes.string,
  sidebar: PropTypes.object.isRequired,
  title: PropTypes.string.isRequired,
}

const defaultProps = {
  isInteractionEnabled: false,
  pageTitle: 'StudentLayout',
}

const StudentLayout = ({ children, isInteractionEnabled, pageTitle, sidebar, title }) => {
  const activeQuestionItem = {
    href: 'activeQuestion',
    label: <FormattedMessage defaultMessage="Active Question" id="joinSessionsidebar.activeQuestion" />,
    name: 'activeQuestion',
  }
  const feedbackChannelItem = {
    href: 'feedbackChannel',
    label: <FormattedMessage defaultMessage="Feedback-Channel" id="joinSessionsidebar.feedbackChannel" />,
    name: 'feedbackChannel',
  }

  const sidebarItems = isInteractionEnabled ? [activeQuestionItem, feedbackChannelItem] : [activeQuestionItem]

  return (
    <CommonLayout baseFontSize="16px" nextHeight="100%" pageTitle={pageTitle}>
      <div className="studentLayout">
        <div className="header">
          <Button basic active={sidebar.sidebarVisible} icon="content" onClick={sidebar.handleToggleSidebarVisible} />
          <h1 className="pageTitle">{title}</h1>
          <Button basic icon="refresh" onClick={() => window.location.reload()} />
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
                font-size: 1.2rem !important;
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
          `}
        </style>
      </div>
    </CommonLayout>
  )
}

StudentLayout.propTypes = propTypes
StudentLayout.defaultProps = defaultProps

export default compose(
  lifecycle({
    componentDidMount() {
      this.props.subscribeToMore()
    },
  })
)(StudentLayout)
