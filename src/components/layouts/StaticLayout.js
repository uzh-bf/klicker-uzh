import React from 'react'
import PropTypes from 'prop-types'
import { Helmet } from 'react-helmet'

import { createLinks, initLogging } from '../../lib'
import { SemanticVersion } from '../../constants'

const propTypes = {
  children: PropTypes.node.isRequired,
  pageTitle: PropTypes.string,
}

const defaultProps = {
  pageTitle: 'StaticLayout',
}

class StaticLayout extends React.Component {
  state = {}

  componentWillMount() {
    // initialize sentry and logrocket (if appropriately configured)
    initLogging()
  }

  render() {
    const { children, pageTitle } = this.props

    return (
      <div className="staticLayout">
        <Helmet defer={false}>
          {createLinks([
            'https://fonts.googleapis.com/css?family=Open Sans',
            `https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/${SemanticVersion}/semantic.min.css`,
          ])}
          <title>{pageTitle}</title>
        </Helmet>

        <div className="content">{children}</div>

        <footer>&copy; IBF</footer>

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
          .staticLayout {
            display: flex;
            flex-direction: column;
            min-height: 100vh;
          }

          footer {
            background-color: lightgrey;
            border-top: 2px solid orange;
            padding: 1rem;
          }
        `}</style>
      </div>
    )
  }
}

StaticLayout.propTypes = propTypes
StaticLayout.defaultProps = defaultProps

export default StaticLayout
