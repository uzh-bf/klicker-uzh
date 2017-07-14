import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Grid } from 'semantic-ui-react'

import pageWithIntl from '../lib/pageWithIntl'
import Footer from './common/Footer'
import withCSS from '../lib/withCSS'

class App extends Component {
  static propTypes = {
    head: PropTypes.node.isRequired,
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
    const { head, children } = this.props

    return (
      <Grid padded="horizontally">
        {head}
        {children}
        <Footer />

        <style jsx global>{`
          * {
            border-radius: 0 !important;
          }
        `}</style>
      </Grid>
    )
  }
}

export default pageWithIntl(withCSS(App, ['reset', 'grid']))
