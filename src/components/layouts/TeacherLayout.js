// @flow

import React, { Component } from 'react'
import Router from 'next/router'
import { FormattedMessage } from 'react-intl'
import { Helmet } from 'react-helmet'

import { initLogging, withCSS } from '../../lib'

import Navbar from '../../components/common/navbar/Navbar'
import Sidebar from '../../components/common/sidebar/Sidebar'

class TeacherLayout extends Component {
  props: {
    actionButton: React.Element<any>,
    children: any,
    head: any,
    intl: $IntlShape,
    navbar: {
      accountShort: string,
      search: {
        query: string,
        sortBy: string,
        sortOrder: string,
        handleSearch: (query: string) => mixed,
        handleSort: (order: string) => mixed,
      },
      title: string,
    },
    pageTitle: string,
    sidebar: {
      activeItem: string,
    },
  }

  static defaultProps = {
    actionButton: null,
    intl: null,
    navbar: null,
    search: null,
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
    const { actionButton, children, intl, head, navbar, pageTitle, sidebar } = this.props

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
        {head}

        <Helmet>
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

export default withCSS(TeacherLayout, [
  'https://fonts.googleapis.com/css?family=Open Sans',
  'reset',
])
