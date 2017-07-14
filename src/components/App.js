import Head from 'next/head'
import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Grid } from 'semantic-ui-react'

import pageWithIntl from '../lib/pageWithIntl'
import Footer from './common/Footer'

class App extends Component {
  static propTypes = {
    children: PropTypes.node.isRequired,
  }

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
          Raven.setDataCallback(data =>
            Object.assign({}, data, {
              extra: {
                sessionURL: LogRocket.sessionURL, // eslint-disable-line no-undef
              },
            }),
          )
        }
      }
    }
  }

  render() {
    return (
      <Grid>
        <Head>
          <link
            rel="stylesheet"
            href="https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/2.2.10/components/reset.min.css"
          />
          <link
            rel="stylesheet"
            href="https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/2.2.10/components/grid.min.css"
          />
        </Head>
        {this.props.children}
        <Footer />
        <style global jsx>{`
          * {
            border-radius: 0 !important;
          }
        `}</style>
      </Grid>
    )
  }
}

export default pageWithIntl(App)
