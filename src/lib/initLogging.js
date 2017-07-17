export default function initLogging() {
  // restrict code execution for trackers to clientside
  if (typeof window !== 'undefined') {
    const ENV = require('./env').default

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
