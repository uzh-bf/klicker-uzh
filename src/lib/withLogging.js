import React from 'react'
import { registerObserver } from 'react-perf-devtool'
import { initGA, logPageView, logException } from '.'

let Raven
let LogRocket
let LogRocketReact
if (process.env.SENTRY_DSN) {
  Raven = require('raven-js')
}
if (process.env.LOGROCKET) {
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
      }

      componentDidMount() {
        if (typeof window !== 'undefined') {
          window._chatlio = window._chatlio || []
          !(function () {
            const t = document.getElementById('chatlio-widget-embed')
            if (t && window.ChatlioReact && _chatlio.init) {
              return void _chatlio.init(t, ChatlioReact)
            }
            for (
              let e = function (t) {
                  return function () {
                    _chatlio.push([t].concat(arguments))
                  }
                },
                i = [
                  'configure',
                  'identify',
                  'track',
                  'show',
                  'hide',
                  'isShown',
                  'isOnline',
                  'page',
                  'open',
                  'showOrHide',
                ],
                a = 0;
              a < i.length;
              a++
            ) {
              _chatlio[i[a]] || (_chatlio[i[a]] = e(i[a]))
            }
            let n = document.createElement('script'),
              c = document.getElementsByTagName('script')[0];
            (n.id = 'chatlio-widget-embed'),
            (n.src = 'https://w.chatlio.com/w.chatlio-widget.js'),
            (n.async = !0),
            n.setAttribute('data-embed-version', '2.3')
            n.setAttribute('data-widget-id', 'd4ec6614-f2cb-4d8a-621d-3d2d1ff2f70c')
            c.parentNode.insertBefore(n, c)
          }())

          if (process.env.NODE_ENV === 'development' && !window.INIT_PERF) {
            // setup react-perf-devtool
            registerObserver()

            // setup why-did-you-update
            // eslint-disable-next-line import/no-extraneous-dependencies
            // const { whyDidYouUpdate } = require('why-did-you-update')
            // whyDidYouUpdate(React)

            window.INIT_PERF = true
          }

          // include google analytics
          if (!window.INIT_GA) {
            initGA()
            logPageView()

            window.INIT_GA = true
          }

          // embed logrocket if enabled
          if (
            process.env.NODE_ENV === 'production' &&
            process.env.LOGROCKET &&
            services.includes('logrocket') &&
            !window.INIT_LR
          ) {
            LogRocket.init(process.env.LOGROCKET)
            LogRocketReact(LogRocket)

            window.INIT_LR = true
          }

          // embed sentry if enabled
          if (
            process.env.NODE_ENV === 'production' &&
            services.includes('raven') &&
            Raven &&
            !window.INIT_RAVEN
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

            window.INIT_RAVEN = true
          }
        }
      }

      componentDidCatch(error, errorInfo) {
        this.setState({ error })

        if (process.env.NODE_ENV === 'production' && services.includes('raven')) {
          Raven.captureException(error, { extra: errorInfo })
          logException(error)
        }
      }

      render() {
        const { error } = this.state
        return <Child {...this.props} error={error} />
      }
    }
  }
