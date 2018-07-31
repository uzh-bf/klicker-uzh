/* eslint-disable */

import React from 'react'
import { initGA, logPageView, logException } from '.'

let Raven
let LogRocket
let LogRocketReact

export default (cfg = {}) =>
  function withLogging(Child) {
    // merge default and passed config
    const config = {
      slaask: false,
      googleAnalytics: true,
      logRocket: true,
      sentry: true,
      ...cfg,
    }

    const isProd = process.env.NODE_ENV === 'production'
    const isDev = process.env.NODE_ENV === 'development'

    if (isProd && process.env.SENTRY_DSN && !Raven) {
      Raven = require('raven-js')
    }
    if (isProd && process.env.LOGROCKET && !LogRocket) {
      LogRocket = require('logrocket')
      LogRocketReact = require('logrocket-react')
    }

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
      }

      componentDidMount() {
        if (typeof window !== 'undefined') {
          /* if (isDev && !window.INIT_PERF) {
            const { registerObserver } = require('react-perf-devtool')

            // setup react-perf-devtool
            registerObserver()

            // setup why-did-you-update
            // eslint-disable-next-line import/no-extraneous-dependencies
            // const { whyDidYouUpdate } = require('why-did-you-update')
            // whyDidYouUpdate(React)

            window.INIT_PERF = true
          } */

          // include google analytics
          if (isProd && process.env.G_ANALYTICS && !window.INIT_GA) {
            initGA(process.env.G_ANALYTICS)
            logPageView()

            window.INIT_GA = true
          }

          // embed logrocket if enabled
          if (isProd && process.env.LOGROCKET && config.logRocket && !window.INIT_LR) {
            LogRocket.init(process.env.LOGROCKET)
            LogRocketReact(LogRocket)

            window.INIT_LR = true
          }

          // embed sentry if enabled
          if (isProd && config.sentry && Raven && !window.INIT_RAVEN) {
            Raven.config(process.env.SENTRY_DSN, {
              environment: process.env.NODE_ENV,
              release: process.env.VERSION,
            }).install()

            // connect logrocket to sentry
            if (process.env.LOGROCKET && config.logRocket) {
              Raven.setDataCallback(data =>
                Object.assign({}, data, {
                  extra: {
                    sessionURL: LogRocket.sessionURL, // eslint-disable-line no-undef
                  },
                })
              )
            }

            window.INIT_RAVEN = true
          }

          // embed slaask if enabled
          if (process.env.SLAASK_WIDGET_KEY && config.slaask) {
            !(function() {
              var x = document.createElement('script')
              ;(x.src = 'https://cdn.slaask.com/chat.js'),
                (x.type = 'text/javascript'),
                (x.async = 'true'),
                (x.onload = x.onreadystatechange = function() {
                  var x = this.readyState
                  if (!x || 'complete' == x || 'loaded' == x)
                    try {
                      _slaask.init(process.env.SLAASK_WIDGET_KEY)
                    } catch (x) {}
                })
              var t = document.getElementsByTagName('script')[0]
              t.parentNode.insertBefore(x, t)
            })()
          }
        }
      }

      componentDidCatch(error, errorInfo) {
        this.setState({ error })

        if (isProd && config.sentry) {
          Raven.captureException(error, { extra: errorInfo })
          Raven.showReportDialog()
          logException(error)
        }
      }

      render() {
        const { error } = this.state
        return <Child {...this.props} error={error} />
      }
    }
  }
