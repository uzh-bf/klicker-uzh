export default function initLogging() {
  // restrict code execution for trackers to clientside
  if (typeof window !== 'undefined') {
    // embed logrocket if enabled
    if (process.env.LOGROCKET !== '__LOGROCKET__') {
      const LogRocket = require('logrocket')
      const LogRocketReact = require('logrocket-react')
      LogRocket.init(process.env.LOGROCKET)
      LogRocketReact(LogRocket)
    }

    // embed sentry if enabled
    if (process.env.SENTRY !== '__SENTRY__') {
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
    }
  }
}
