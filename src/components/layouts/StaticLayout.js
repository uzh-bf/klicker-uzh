// @flow

import React, { Component } from 'react'
import { Helmet } from 'react-helmet'

import { createLinks, initLogging } from '../../lib'

class StaticLayout extends Component {
  props: {
    children: any,
    pageTitle: string,
  }

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
          {createLinks(['https://fonts.googleapis.com/css?family=Open Sans','reset'])}
          <title>
            {pageTitle}
          </title>
        </Helmet>

        <div className="content">
          {children}
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
          .staticLayout {
            display: flex;
            flex-direction: column;
            min-height: 100vh;
          }
        `}</style>
      </div>
    )
  }
}

export default StaticLayout
