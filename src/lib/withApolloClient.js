// https://github.com/zeit/next.js/blob/canary/examples/with-apollo/lib/with-apollo-client.js
/* eslint-disable react/prop-types */
import React from 'react'
import Head from 'next/head'
import { getDataFromTree } from 'react-apollo'

import initApollo from './initApollo'

export default App =>
  class Apollo extends React.Component {
    static async getInitialProps(ctx) {
      const { Component, router, res } = ctx

      // initialize apollo client
      const apollo = initApollo()

      // inject apollo client to the context passed down to the app component
      ctx.ctx.apolloClient = apollo

      let appProps = {}
      if (App.getInitialProps) {
        appProps = await App.getInitialProps(ctx)
      }

      if (res && res.finished) {
        // When redirecting, the response is finished.
        // No point in continuing to render
        return {}
      }

      // Run all GraphQL queries in the component tree
      // and extract the resulting data
      if (!process.browser) {
        try {
          // Run all GraphQL queries
          await getDataFromTree(<App {...appProps} Component={Component} apolloClient={apollo} router={router} />)
        } catch (error) {
          // Prevent Apollo Client GraphQL errors from crashing SSR.
          // Handle them in components via the data.error prop:
          // http://dev.apollodata.com/react/api-queries.html#graphql-query-data-error
          console.error('Error while running `getDataFromTree`', error)
        }

        // getDataFromTree does not call componentWillUnmount
        // head side effect therefore need to be cleared manually
        Head.rewind()
      }

      // Extract query data from the Apollo store
      const apolloState = apollo.cache.extract()

      return {
        ...appProps,
        apolloState,
      }
    }

    static displayName = 'withApollo(App)'

    constructor(props) {
      super(props)
      this.apolloClient = initApollo(props.apolloState)
    }

    render() {
      return <App {...this.props} apolloClient={this.apolloClient} />
    }
  }
