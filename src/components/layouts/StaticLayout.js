// @flow

import React, { Component } from 'react'

import { initLogging, withCSS } from '../../lib'

class StaticLayout extends Component {
  props: {
    children: any,
    head: 'next/head',
  }

  state = {}

  componentWillMount() {
    // initialize sentry and logrocket (if appropriately configured)
    initLogging()
  }

  render() {
    const { children, head } = this.props

    return (
      <div className="staticLayout">
        {head}

        {children}

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

export default withCSS(StaticLayout, ['https://fonts.googleapis.com/css?family=Open Sans', 'reset'])
