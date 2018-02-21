import React from 'react'
import PropTypes from 'prop-types'
import Router from 'next/router'
import { compose, withState, withHandlers } from 'recompose'
import { FormattedMessage, intlShape } from 'react-intl'

import { CommonLayout } from '.'
import { Navbar } from '../../components/common/navbar'
import { Sidebar } from '../../components/common/sidebar'

const propTypes = {
  actionArea: PropTypes.element,
  children: PropTypes.node.isRequired,
  fixedHeight: PropTypes.bool,
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
  fixedHeight: false,
  navbar: undefined,
  pageTitle: 'TeacherLayout',
}

const TeacherLayout = ({
  actionArea,
  children,
  fixedHeight,
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
      label: <FormattedMessage defaultMessage="Question Pool" id="questionPool.title" />,
      name: 'questionPool',
    },
    {
      href: '/sessions',
      label: <FormattedMessage defaultMessage="Session List" id="sessionList.title" />,
      name: 'sessionList',
    },
    {
      href: '/sessions/running',
      label: <FormattedMessage defaultMessage="Running Session" id="runningSession.title" />,
      name: 'runningSession',
    },
    {
      href: '/questions/create',
      icon: 'plus',
      label: <FormattedMessage defaultMessage="Create Question" id="createQuestion.title" />,
      name: 'createQuestion',
    },
  ]

  return (
    <CommonLayout baseFontSize="14px" pageTitle={pageTitle}>
      <div className="teacherLayout">
        {navbar && (
          <div className="navbar">
            <Navbar
              handleSidebarToggle={handleSidebarToggle}
              intl={intl}
              sidebarVisible={isSidebarVisible}
              title={intl.formatMessage({
                id: `${sidebar.activeItem}.title`,
              })}
              {...navbar}
            />
          </div>
        )}

        <div className="content">
          <Sidebar
            handleSidebarItemClick={handleSidebarItemClick}
            items={sidebarItems}
            visible={isSidebarVisible}
            {...sidebar}
          >
            {children}
          </Sidebar>
        </div>

        <div className="actionArea">{actionArea}</div>

        <style jsx>{`
          .teacherLayout {
            display: flex;
            flex-direction: column;
            height: ${fixedHeight ? '100vh' : 'initial'};
            min-height: ${fixedHeight ? 'initial' : '100vh'};

            .navbar {
              flex: 0 0 auto;
            }

            .content {
              background-color: white;

              flex: 1;

              display: flex;

              overflow: hidden;
            }

            .actionArea {
              flex: 0 0 auto;
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
)(TeacherLayout)
