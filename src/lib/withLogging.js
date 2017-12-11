import initOpbeat from 'opbeat-react'
import React from 'react'

let Raven
if (process.env.SENTRY_DSN) {
  Raven = require('raven-js')
  console.log(Raven)
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

      if (process.env.OPBEAT_APP_ID) {
        initOpbeat({
          active: process.env.NODE_ENV === 'production',
          appId: process.env.OPBEAT_APP_ID,
          orgId: process.env.OPBEAT_ORG_ID,
        })
      }

      if (Raven) {
        Raven.config(process.env.SENTRY_DSN, {
          environment: process.env.NODE_ENV,
          release: process.env.VERSION,
        }).install()
      }
    }

    componentDidCatch(error, errorInfo) {
      this.setState({ error })

      if (process.env.OPBEAT_APP_ID) {
        const { captureError } = require('opbeat-react')
        captureError(error, errorInfo)
        console.error(error)
      }

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
