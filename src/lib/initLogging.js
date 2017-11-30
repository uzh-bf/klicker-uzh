let logrocket = false
let sentry = false
let hotjar = false

export default function initLogging() {
  // restrict code execution for trackers to clientside
  if (typeof window !== 'undefined') {
    // embed logrocket if enabled
    if (!logrocket && process.env.LOGROCKET && process.env.LOGROCKET !== '__LOGROCKET__') {
      const LogRocket = require('logrocket')
      const LogRocketReact = require('logrocket-react')
      LogRocket.init(process.env.LOGROCKET)
      LogRocketReact(LogRocket)

      logrocket = true
    }

    // embed sentry if enabled
    if (!sentry && process.env.SENTRY && process.env.SENTRY !== '__SENTRY__') {
      const Raven = require('raven-js')

      Raven.config(process.env.SENTRY).install()

      if (process.env.LOGROCKET !== '__LOGROCKET__') {
        Raven.setDataCallback(data =>
          Object.assign({}, data, {
            extra: {
              sessionURL: LogRocket.sessionURL, // eslint-disable-line no-undef
            },
          }),
        )
      }

      sentry = true
    }

    if (!hotjar && process.env.HOTJAR) {
      const { hotjar: hj } = require('react-hotjar')

      // TODO: make hotjar tracking code dynamic
      hj.initialize(702378, 6)
      hotjar = true
    }
  }
}
