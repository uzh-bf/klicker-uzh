import React from 'react'
import { registerObserver } from 'react-perf-devtool'

const initialized = []

let Raven
let LogRocket
let LogRocketReact
if (process.env.SENTRY_DSN && !initialized.contains('raven')) {
  Raven = require('raven-js')
}
if (process.env.LOGROCKET && !initialized.contains('logrocket')) {
  LogRocket = require('logrocket')
  LogRocketReact = require('logrocket-react')
}

export default (services = ['ga', 'raven', 'logrocket']) =>
  function withLogging(Child) {
    return class WrappedComponent extends React.Component {
      static getInitialProps(context) {
        if (Child.getInitialProps) {
          return Child.getInitialProps(context)
        }
        return {}
      }
      constructor(props) {
        super(props)
        this.state = { error: null }

        if (typeof window !== 'undefined') {
          if (process.env.NODE_ENV === 'development' && !initialized.contains('perf')) {
            // setup react-perf-devtool
            registerObserver()

            initialized.append('perf')
          }

          // TODO: include google analytics

          // embed logrocket if enabled
          if (
            process.env.NODE_ENV === 'production' &&
            process.env.LOGROCKET &&
            services.includes('logrocket') &&
            !initialized.contains('logrocket')
          ) {
            LogRocket.init(process.env.LOGROCKET)
            LogRocketReact(LogRocket)

            initialized.append('logrocket')
          }

          // embed sentry if enabled
          if (
            process.env.NODE_ENV === 'production' &&
            services.includes('raven') &&
            Raven &&
            !initialized.contains('raven')
          ) {
            Raven.config(process.env.SENTRY_DSN, {
              environment: process.env.NODE_ENV,
              release: process.env.VERSION,
            }).install()

            // connect logrocket to sentry
            if (process.env.LOGROCKET && services.includes('logrocket')) {
              Raven.setDataCallback(data =>
                Object.assign({}, data, {
                  extra: {
                    sessionURL: LogRocket.sessionURL, // eslint-disable-line no-undef
                  },
                }),
              )
            }

            initialized.append('raven')
          }
        }
      }

      componentDidCatch(error, errorInfo) {
        this.setState({ error })

        if (process.env.NODE_ENV === 'production' && services.includes('raven')) {
          Raven.captureException(error, { extra: errorInfo })
        }
      }

      render() {
        const { error } = this.state
        return <Child {...this.props} error={error} />
      }
    }
  }
