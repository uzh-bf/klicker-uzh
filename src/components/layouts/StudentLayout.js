import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage } from 'react-intl'
import { Helmet } from 'react-helmet'
import { Button } from 'semantic-ui-react'

import { createLinks, initLogging } from '../../lib'

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

class StudentLayout extends React.Component {
  state = {
    sidebarVisible: false,
  }

  componentWillMount() {
    // initialize sentry and logrocket (if appropriately configured)
    initLogging()
  }

  handleSidebarItemClick = sidebarActiveItem => () => {
    this.handleSidebarToggle()
    this.props.sidebar.handleItemChange(sidebarActiveItem)
  }

  handleSidebarToggle = () => {
    this.setState(prevState => ({ sidebarVisible: !prevState.sidebarVisible }))
  }

  render() {
    const {
      children, pageTitle, sidebar, title,
    } = this.props

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
        <Helmet defer={false}>
          {createLinks([
            'https://fonts.googleapis.com/css?family=Open Sans',
            'https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/2.2.13/semantic.min.css',
          ])}
          <title>{pageTitle}</title>
        </Helmet>

        <div className="header">
          <Button basic icon="content" onClick={this.handleSidebarToggle} />
          <h1>{title}</h1>
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

StudentLayout.propTypes = propTypes
StudentLayout.defaultProps = defaultProps

export default StudentLayout
