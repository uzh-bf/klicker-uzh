// @flow

import React, { Component } from 'react'
import Router from 'next/router'
import { FormattedMessage } from 'react-intl'
import { Helmet } from 'react-helmet'

import { createLinks, initLogging } from '../../lib'

import Navbar from '../../components/common/navbar/Navbar'
import Sidebar from '../../components/common/sidebar/Sidebar'

class TeacherLayout extends Component {
  props: {
    actionButton?: React.Element<*>,
    children: any,
    intl: $IntlShape,
    navbar: {
      accountShort: string,
      search?: {
        query: string,
        sortBy: string,
        sortOrder: string,
        handleSearch: (query: string) => mixed,
        handleSort: (by: string, order: string) => mixed,
      },
      title: string,
    },
    pageTitle: string,
    sidebar: {
      activeItem: string,
    },
  }

  static defaultProps = {
    actionButton: undefined,
  }

  state = {
    sidebarVisible: false,
  }

  componentWillMount() {
    // initialize sentry and logrocket (if appropriately configured)
    initLogging()
  }

  handleSidebarItemClick = (href: string) => () => {
    Router.push(href)
  }

  handleSidebarToggle = () => {
    this.setState(prevState => ({ sidebarVisible: !prevState.sidebarVisible }))
  }

  render() {
    const { actionButton, children, intl, navbar, pageTitle, sidebar } = this.props

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
        <Helmet>
          {createLinks(['https://fonts.googleapis.com/css?family=Open Sans'], ['reset'])}
          <title>
            {pageTitle}
          </title>
        </Helmet>

        {navbar &&
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
          </div>}

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

        {actionButton &&
          <div className="actionArea">
            {actionButton}
          </div>}

        <style jsx global>{`
          * {
            font-family: 'Open Sans', sans-serif;
          }

          html,
          body {
            font-size: 14px;
          }

          .noBorder {
            border: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
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
            bottom: 2rem;
            right: 2rem;
          }
        `}</style>
      </div>
    )
  }
}

export default TeacherLayout
