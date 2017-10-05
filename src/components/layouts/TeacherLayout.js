import React, { Component } from 'react'
import Router from 'next/router'
import HTML5Backend from 'react-dnd-html5-backend'
import { FormattedMessage } from 'react-intl'
import { Helmet } from 'react-helmet'
import { DragDropContext } from 'react-dnd'

import Navbar from '../../components/common/navbar/Navbar'
import Sidebar from '../../components/common/sidebar/Sidebar'
import { createLinks, initLogging } from '../../lib'

class TeacherLayout extends Component {
  static defaultProps = {
    actionArea: undefined,
  }

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
    const { actionArea, children, intl, navbar, pageTitle, sidebar } = this.props

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
            'https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/2.2.13/semantic.min.css',
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

          html,
          body {
            font-size: 14px;
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

const withDnD = DragDropContext(HTML5Backend)

export default withDnD(TeacherLayout)
