// @flow

import React, { Component } from 'react'
import { FormattedMessage } from 'react-intl'
import { Button } from 'semantic-ui-react'

import Sidebar from '../common/sidebar/Sidebar'
import initLogging from '../../lib/initLogging'
import withCSS from '../../lib/withCSS'

class StudentLayout extends Component {
  props: {
    children: any,
    head: 'next/head',
    sidebar: {
      handleItemChange: (newItem: string) => mixed,
    },
    title: string,
  }

  state = {
    sidebarActiveItem: 'activeQuestion',
    sidebarVisible: false,
  }

  componentWillMount() {
    // initialize sentry and logrocket (if appropriately configured)
    initLogging()
  }

  handleSidebarItemClick = (sidebarActiveItem: string) => () => {
    this.setState({ sidebarActiveItem })
    this.handleSidebarToggle()
    this.props.sidebar.handleItemChange(sidebarActiveItem)
  }

  handleSidebarToggle = () => {
    this.setState(prevState => ({ sidebarVisible: !prevState.sidebarVisible }))
  }

  render() {
    const { children, head, sidebar, title } = this.props

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
          <FormattedMessage
            id="student.sidebar.feedbackChannel"
            defaultMessage="Feedback-Channel"
          />
        ),
        name: 'feedbackChannel',
      },
    ]

    return (
      <div className="studentLayout">
        {head}

        <div className="header">
          <Button basic icon="content" onClick={this.handleSidebarToggle} />
          <h1>
            {title}
          </h1>
        </div>

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

        <style jsx global>{`
          * {
            font-family: 'Open Sans', sans-serif;
          }

          html {
            font-size: 16px;
          }

          body {
            font-size: 1rem;
          }
        `}</style>

        <style jsx>{`
          .studentLayout {
            display: flex;
            flex-direction: column;

            min-height: 100vh;
          }

          .header {
            flex: 0 0 auto;

            display: flex;
            align-items: center;

            border-bottom: 1px solid lightgrey;
            padding: .5rem;
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

          @media all and (min-width: 768px) {
            .header {
              display: none;
            }
          }
        `}</style>
      </div>
    )
  }
}

export default withCSS(StudentLayout, [
  'https://fonts.googleapis.com/css?family=Open Sans',
  'reset',
  'button',
  'icon',
  'menu',
  'sidebar',
])
