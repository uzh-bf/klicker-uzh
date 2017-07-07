import { FormattedMessage } from 'react-intl'
import React, { Component } from 'react'
import pageWithIntl from '../lib/pageWithIntl'

class App extends Component {
  componentWillMount() {
    // restrict code execution to clientside
    if (typeof window !== 'undefined') {
      const ENV = require('../lib/env').default

      // embed logrocket if enabled
      if (ENV.LOGROCKET !== '__LOGROCKET__') {
        const LogRocket = require('logrocket')
        const LogRocketReact = require('logrocket-react')

        LogRocket.init(ENV.LOGROCKET)
        LogRocketReact(LogRocket)
      }

      // embed sentry if enabled
      if (ENV.SENTRY !== '__SENTRY__') {
        const Raven = require('raven-js')

        Raven.config(ENV.SENTRY).install()

        if (ENV.LOGROCKET !== '__LOGROCKET__') {
          Raven.setDataCallback((data) => {
            data.extra.sessionURL = LogRocket.sessionURL
            return data
          })
        }
      }
    }
  }

  render() {
    return (
      <main>
        <header>
          <h1>
            <FormattedMessage id="title" defaultMessage="Hello World" />
          </h1>
        </header>
        {this.props.children}
      </main>
    )
  }
}

export default pageWithIntl(App)
