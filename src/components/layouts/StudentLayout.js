import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage } from 'react-intl'
import { Button } from 'semantic-ui-react'

import { CommonLayout } from '.'
import { Sidebar } from '../common/sidebar'

const propTypes = {
  children: PropTypes.node.isRequired,
  pageTitle: PropTypes.string,
  sidebar: PropTypes.shape(Sidebar.propTypes).isRequired,
  title: PropTypes.string.isRequired,
}

const defaultProps = {
  pageTitle: 'StudentLayout',
}

const StudentLayout = ({
  children, pageTitle, sidebar, title,
}) => {
  const sidebarItems = [
    {
      href: 'activeQuestion',
      label: (
        <FormattedMessage id="student.sidebar.activeQuestion" defaultMessage="Active Question" />
      ),
      name: 'activeQuestion',
    },
    {
      href: 'feedbackChannel',
      label: (
        <FormattedMessage id="student.sidebar.feedbackChannel" defaultMessage="Feedback-Channel" />
      ),
      name: 'feedbackChannel',
    },
  ]

  return (
    <CommonLayout baseFontSize="16px" pageTitle={pageTitle}>
      <div className="studentLayout">
        <div className="header">
          <Button basic icon="content" onClick={sidebar.handleToggleSidebarVisible} />
          <h1>{title}</h1>
        </div>

        <div className="content">
          <Sidebar
            items={sidebarItems}
            visible={sidebar.sidebarVisible}
            activeItem={sidebar.activeItem}
            handleSidebarItemClick={sidebar.handleSidebarActiveItemChange}
          >
            {children}
          </Sidebar>
        </div>

        <style jsx>{`
          @import 'src/_theme';

          .studentLayout {
            display: flex;
            flex-direction: column;

            min-height: 100vh;

            .header {
              flex: 0 0 auto;

              display: flex;
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
