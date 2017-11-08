import React from 'react'
import PropTypes from 'prop-types'
import Router from 'next/router'
import HTML5Backend from 'react-dnd-html5-backend'
import { compose, withState, withHandlers } from 'recompose'
import { FormattedMessage, intlShape } from 'react-intl'
import { DragDropContext } from 'react-dnd'

import { CommonLayout } from '.'
import { Navbar } from '../../components/common/navbar'
import { Sidebar } from '../../components/common/sidebar'

const propTypes = {
  actionArea: PropTypes.element,
  children: PropTypes.node.isRequired,
  handleSidebarItemClick: PropTypes.func.isRequired,
  handleSidebarToggle: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  isSidebarVisible: PropTypes.bool.isRequired,
  navbar: PropTypes.shape(Navbar.propTypes),
  pageTitle: PropTypes.string,
  sidebar: PropTypes.shape(Sidebar.propTypes).isRequired,
}

const defaultProps = {
  actionArea: undefined,
  navbar: undefined,
  pageTitle: 'TeacherLayout',
}

const TeacherLayout = ({
  actionArea,
  children,
  intl,
  navbar,
  pageTitle,
  sidebar,
  isSidebarVisible,
  handleSidebarToggle,
  handleSidebarItemClick,
}) => {
  const sidebarItems = [
    {
      href: '/questions',
      label: <FormattedMessage id="teacher.questionPool.title" defaultMessage="Question Pool" />,
      name: 'questionPool',
    },
    {
      href: '/sessions',
      label: <FormattedMessage id="teacher.sessionHistory.title" defaultMessage="Sessions" />,
      name: 'sessionHistory',
    },
    {
      href: '/sessions/running',
      label: (
        <FormattedMessage id="teacher.runningSession.title" defaultMessage="Running Session" />
      ),
      name: 'runningSession',
    },
  ]

  return (
    <CommonLayout baseFontSize="14px" pageTitle={pageTitle}>
      <div className="teacherLayout">
        {navbar && (
          <div className="navbar">
            <Navbar
              intl={intl}
              sidebarVisible={isSidebarVisible}
              title={intl.formatMessage({
                id: `teacher.${sidebar.activeItem}.title`,
              })}
              handleSidebarToggle={handleSidebarToggle}
              {...navbar}
            />
          </div>
        )}

        <div className="content">
          <Sidebar
            items={sidebarItems}
            visible={isSidebarVisible}
            handleSidebarItemClick={handleSidebarItemClick}
            {...sidebar}
          >
            {children}
          </Sidebar>
        </div>

        {actionArea && <div className="actionArea">{actionArea}</div>}

        <style jsx global>{`
          * {
            font-family: 'Open Sans', sans-serif;
          }

          html,
          body {
            font-size: 14px;
          }

          input,
          button,
          .noBorder {
            border-radius: 0 !important;
          }

          .noBorder {
            border: 0 !important;
            box-shadow: none !important;
          }
        `}</style>

        <style jsx>{`
          .teacherLayout {
            display: flex;
            flex-direction: column;
            min-height: 100vh;

            .content {
              flex: 1;

              display: flex;
            }

            .actionArea {
              position: fixed;
              bottom: 0;
              right: 0;
              left: 0;
            }
          }
        `}</style>
      </div>
    </CommonLayout>
  )
}

TeacherLayout.propTypes = propTypes
TeacherLayout.defaultProps = defaultProps

export default compose(
  withState('isSidebarVisible', 'setIsSidebarVisible', false),
  withHandlers({
    handleSidebarItemClick: () => href => () => {
      Router.push(href)
    },
    handleSidebarToggle: ({ setIsSidebarVisible }) => () => {
      setIsSidebarVisible(prevState => !prevState)
    },
  }),
  DragDropContext(HTML5Backend),
)(TeacherLayout)
