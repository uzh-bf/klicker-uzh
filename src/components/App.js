import Head from 'next/head'
import React, { Component } from 'react'
import { FormattedMessage } from 'react-intl'
import PropTypes from 'prop-types'
import { Grid } from 'semantic-ui-react'
import pageWithIntl from '../lib/pageWithIntl'

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
        <Grid.Row columns="1">
          <Grid.Column>
            <header>
              <h1>Klicker</h1>
            </header>
          </Grid.Column>
        </Grid.Row>
        <Grid.Row columns="1">
          <Grid.Column>
            <Grid>
              {this.props.children}
            </Grid>
          </Grid.Column>
        </Grid.Row>
        <style jsx>{`
          h1 {
            background-color: black;
          }
        `}</style>
      </Grid>
    )
  }
}

export default pageWithIntl(App)
