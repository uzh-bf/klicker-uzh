/* eslint-disable */

import React from 'react'
import getConfig from 'next/config'

const { publicRuntimeConfig } = getConfig()

const Raven = publicRuntimeConfig.sentryDSN && require('raven-js')

const isProd = process.env.NODE_ENV === 'production'
const isDev = process.env.NODE_ENV === 'development'

let LogRocket
let LogRocketReact

let APM

if (isProd && publicRuntimeConfig.logrocketAppID) {
  LogRocket = require('logrocket')
  LogRocketReact = require('logrocket-react')
}

export default (cfg = {}) =>
  function withLogging(Child) {
    // merge default and passed config
    const config = {
      slaask: false,
      logRocket: true,
      ...cfg,
    }

    return class WrappedComponent extends React.Component {
      static getInitialProps(context) {
        if (Child.getInitialProps) {
          return Child.getInitialProps(context)
        }
        return {}
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

          if (isProd) {
            // embed elastic apm if enabled
            if (publicRuntimeConfig.apmWithRum && !window.INIT_APM) {
              const { init } = require('elastic-apm-js-base')

              APM = init({
                // Set required service name (allowed characters: a-z, A-Z, 0-9, -, _, and space)
                serviceName: publicRuntimeConfig.apmServiceName,

                // Set custom APM Server URL (default: http://localhost:8200)
                serverUrl: publicRuntimeConfig.apmServerUrl,
              })

              window.INIT_APM = true
            }
            // embed logrocket if enabled
            if (publicRuntimeConfig.logrocketAppID && config.logRocket && !window.INIT_LR) {
              LogRocket.init(publicRuntimeConfig.logrocketAppID)
              LogRocketReact(LogRocket)

              if (Raven && window.INIT_RAVEN) {
                Raven.setDataCallback(data =>
                  Object.assign({}, data, {
                    extra: {
                      sessionURL: LogRocket.sessionURL, // eslint-disable-line no-undef
                    },
                  })
                )
              }

              window.INIT_LR = true
            }

            // embed slaask if enabled
            if (publicRuntimeConfig.slaaskWidgetKey && config.slaask) {
              !(function() {
                var x = document.createElement('script')
                ;(x.src = 'https://cdn.slaask.com/chat.js'),
                  (x.type = 'text/javascript'),
                  (x.async = 'true'),
                  (x.onload = x.onreadystatechange = function() {
                    var x = this.readyState
                    if (!x || 'complete' == x || 'loaded' == x)
                      try {
                        _slaask.init(publicRuntimeConfig.slaaskWidgetKey)
                      } catch (x) {}
                  })
                var t = document.getElementsByTagName('script')[0]
                t.parentNode.insertBefore(x, t)
              })()
            }
          }
        }
      }

      render() {
        return <Child {...this.props} />
      }
    }
  }
