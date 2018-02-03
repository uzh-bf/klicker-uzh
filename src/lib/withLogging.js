import React from 'react'

let Raven
if (process.env.SENTRY_DSN) {
  Raven = require('raven-js')
}

export default function withLogging(Child) {
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

      if (Raven) {
        Raven.config(process.env.SENTRY_DSN, {
          environment: process.env.NODE_ENV,
          release: process.env.VERSION,
        }).install()
      }
    }

    componentDidCatch(error, errorInfo) {
      this.setState({ error })

      if (Raven) {
        Raven.captureException(error, { extra: errorInfo })
      }
    }

    render() {
      const { error } = this.state
      return <Child {...this.props} error={error} />
    }
  }
}
