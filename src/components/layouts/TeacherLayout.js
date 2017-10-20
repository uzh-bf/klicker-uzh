import React from 'react'
import PropTypes from 'prop-types'
import Router from 'next/router'
import HTML5Backend from 'react-dnd-html5-backend'
import { compose } from 'recompose'
import { FormattedMessage, intlShape } from 'react-intl'
import { Helmet } from 'react-helmet'
import { DragDropContext } from 'react-dnd'

import { Navbar } from '../../components/common/navbar'
import { Sidebar } from '../../components/common/sidebar'
import { createLinks, initLogging } from '../../lib'
import { SemanticVersion } from '../../constants'

const propTypes = {
  actionArea: PropTypes.element,
  children: PropTypes.node.isRequired,
  intl: intlShape.isRequired,
  navbar: PropTypes.shape(Navbar.propTypes),
  pageTitle: PropTypes.string,
  sidebar: PropTypes.shape(Sidebar.propTypes).isRequired,
}

const defaultProps = {
  actionArea: undefined,
  navbar: undefined,
  pageTitle: 'TeacherLayout',
}

class TeacherLayout extends React.Component {
  state = {
    sidebarVisible: false,
  }

  componentWillMount() {
    // initialize sentry and logrocket (if appropriately configured)
    initLogging()
  }

  handleSidebarItemClick = href => () => {
    Router.push(href)
  }

  handleSidebarToggle = () => {
    this.setState(prevState => ({ sidebarVisible: !prevState.sidebarVisible }))
  }

  render() {
    const {
      actionArea, children, intl, navbar, pageTitle, sidebar,
    } = this.props

    const sidebarItems = [
      {
        href: '/questions',
        label: <FormattedMessage id="teacher.questionPool.title" defaultMessage="Question Pool" />,
        name: 'questionPool',
      },
      {
        href: '/sessions',
        label: (
          <FormattedMessage id="teacher.sessionHistory.title" defaultMessage="Session History" />
        ),
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
      <div className="teacherLayout">
        <Helmet defer={false}>
          {createLinks([
            'https://fonts.googleapis.com/css?family=Open Sans',
            `https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/${SemanticVersion}/semantic.min.css`,
          ])}
          <title>{pageTitle}</title>
        </Helmet>

        {navbar && (
          <div className="navbar">
            <Navbar
              intl={intl}
              sidebarVisible={this.state.sidebarVisible}
              title={intl.formatMessage({
                id: `teacher.${sidebar.activeItem}.title`,
              })}
              handleSidebarToggle={this.handleSidebarToggle}
              {...navbar}
            />
          </div>
        )}

        <div className="content">
          <Sidebar
            items={sidebarItems}
            visible={this.state.sidebarVisible}
            handleSidebarItemClick={this.handleSidebarItemClick}
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

          html {
            font-size: 14px;
          }

          body {
            font-size: 1rem;
          }

          input,
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
          }

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
        `}</style>
      </div>
    )
  }
}

TeacherLayout.propTypes = propTypes
TeacherLayout.defaultProps = defaultProps

export default compose(DragDropContext(HTML5Backend))(TeacherLayout)
