// @flow

import * as React from 'react'
import { Helmet } from 'react-helmet'

import { createLinks, initLogging } from '../../lib'

type Props = {
  children: React.Node,
  pageTitle: string,
}
type State = {}

class StaticLayout extends React.Component<Props, State> {
  state = {}

  componentWillMount() {
    // initialize sentry and logrocket (if appropriately configured)
    initLogging()
  }

  render() {
    const { children, pageTitle } = this.props

    return (
      <div className="staticLayout">
        <Helmet>
          {createLinks(['https://fonts.googleapis.com/css?family=Open Sans', 'reset'])}
          <title>
            {pageTitle}
          </title>
        </Helmet>

        <div className="content">
          {children}
        </div>

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

export default StaticLayout
