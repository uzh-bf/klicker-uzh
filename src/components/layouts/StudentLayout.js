// @flow

import React, { Component } from 'react'

import initLogging from '../../lib/initLogging'
import withCSS from '../../lib/withCSS'

class StudentLayout extends Component {
  props: {
    children: any,
    head: 'next/head',
  }

  static defaultProps = {}

  state = {}

  componentWillMount() {
    // initialize sentry and logrocket (if appropriately configured)
    initLogging()
  }

  render() {
    const { children, head } = this.props

    return (
      <div className="studentLayout">
        {head}

        <div className="header">
          <button>hello</button>
        </div>

        <div className="content">
          {children}
        </div>

        <style jsx global>{`
          * {
            font-family: 'Open Sans', sans-serif;
          }
          html,
          body {
            font-size: 16px;
          }
        `}</style>

        <style jsx>{`
          .studentLayout {
            display: flex;
            flex-direction: column;
            min-height: 100vh;
          }
          .header {
            display: flex;
            background-color: lightgrey;
            padding: 1rem;
          }
          .content {
            display: flex;
            flex: 1;
          }
        `}</style>
      </div>
    )
  }
}

export default withCSS(StudentLayout, [
  'https://fonts.googleapis.com/css?family=Open Sans',
  'reset',
])
