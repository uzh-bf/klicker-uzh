/* eslint-disable react/prop-types */
import initOpbeat, { captureError } from 'opbeat-react'
import Raven from 'raven-js'

import React from 'react'
import { ApolloProvider, getDataFromTree } from 'react-apollo'
import Head from 'next/head'
import initApollo from './initApollo'
import initRedux from './initRedux'

let logrocket = null
let hotjar = null
let sentry = null
let opbeat = null

// Gets the display name of a JSX component for dev tools
function getComponentDisplayName(Component) {
  return Component.displayName || Component.name || 'Unknown'
}

export default ComposedComponent =>
  class WithData extends React.Component {
    static displayName = `WithData(${getComponentDisplayName(ComposedComponent)})`

    static async getInitialProps(ctx) {
      let serverState = {}

      // Evaluate the composed component's getInitialProps()
      let composedInitialProps = {}
      if (ComposedComponent.getInitialProps) {
        composedInitialProps = await ComposedComponent.getInitialProps(ctx)
      }

      // Run all GraphQL queries in the component tree
      // and extract the resulting data
      if (!process.browser) {
        const apollo = initApollo()
        const redux = initRedux(apollo)
        // Provide the `url` prop data in case a GraphQL query uses it
        const url = { pathname: ctx.pathname, query: ctx.query }

        try {
          // Run all GraphQL queries
          await getDataFromTree(
            // No need to use the Redux Provider
            // because Apollo sets up the store for us
            <ApolloProvider client={apollo} store={redux}>
              <ComposedComponent url={url} {...composedInitialProps} />
            </ApolloProvider>,
          )
        } catch (error) {
          // Prevent Apollo Client GraphQL errors from crashing SSR.
          // Handle them in components via the data.error prop:
          // http://dev.apollodata.com/react/api-queries.html#graphql-query-data-error
        }

        // getDataFromTree does not call componentWillUnmount
        // head side effect therefore need to be cleared manually
        Head.rewind()

        // Extract query data from the store
        const state = redux.getState()

        // No need to include other initial Redux state because when it
        // initialises on the client-side it'll create it again anyway
        serverState = {
          apollo: {
            // Only include the Apollo data state
            data: state.apollo.data,
          },
        }
      }

      return {
        serverState,
        ...composedInitialProps,
      }
    }

    constructor(props) {
      super(props)
      this.apollo = initApollo()
      this.redux = initRedux(this.apollo, this.props.serverState) // eslint-disable-line

      // setup additional error handling for all pages with data
      this.state = { error: null }

      if (process.browser) {
        // setup opbeat if so configured
        if (process.env.OPBEAT_APP_ID && !opbeat) {
          initOpbeat({
            active: process.env.NODE_ENV === 'production',
            appId: process.env.OPBEAT_APP_ID,
            orgId: process.env.OPBEAT_ORG_ID,
          })

          opbeat = true
        }

        // setup logrocket if so configured
        if (process.env.LOGROCKET && !logrocket) {
          const LogRocket = require('logrocket')
          const LogRocketReact = require('logrocket-react')

          LogRocket.init(process.env.LOGROCKET)
          LogRocketReact(LogRocket)

          logrocket = true
        }

        // setup sentry if so configured
        if (process.env.SENTRY_DSN && !sentry) {
          Raven.config(process.env.SENTRY_DSN, {
            environment: process.env.NODE_ENV,
            release: process.env.VERSION,
          }).install()

          if (process.env.LOGROCKET) {
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

        if (process.env.HOTJAR && !hotjar) {
          const { hotjar: hj } = require('react-hotjar')

          hj.initialize(process.env.HOTJAR, 6)

          hotjar = true
        }
      }
    }

    componentDidCatch(error, errorInfo) {
      // set the component error state
      this.setState({ error })

      // log the error to console, opbeat and/or sentry
      console.error(error)
      if (process.env.OPBEAT_APP_ID) {
        console.log('opbeat catch')
        captureError(error, errorInfo)
      }
      if (process.env.SENTRY_DSN) {
        console.log('sentry catch')
        Raven.captureException(error, { extra: errorInfo })
      }
    }

    render() {
      const { error } = this.state

      return (
        // No need to use the Redux Provider
        // because Apollo sets up the store for us
        <ApolloProvider client={this.apollo} store={this.redux}>
          <ComposedComponent {...this.props} error={error} />
        </ApolloProvider>
      )
    }
  }
