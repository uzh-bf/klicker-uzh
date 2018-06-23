// https://github.com/zeit/next.js/blob/canary/examples/with-apollo/lib/with-apollo-client.js
/* eslint-disable react/prop-types */

import React from 'react'
import { getDataFromTree } from 'react-apollo'
import Head from 'next/head'
import initApollo from './initApollo'

export default App => class Apollo extends React.Component {
  static async getInitialProps(ctx) {
    const { Component, router } = ctx

    let appProps = {}
    if (App.getInitialProps) {
      appProps = await App.getInitialProps(ctx)
    }

    const apolloState = {}

    // Run all GraphQL queries in the component tree
    // and extract the resulting data
    const apollo = initApollo()
    try {
      // Run all GraphQL queries
      await getDataFromTree(
        <App
          {...appProps}
          Component={Component}
          apolloClient={apollo}
          apolloState={apolloState}
          router={router}
        />,
        {
          // FIXME: workaround for https://github.com/zeit/next.js/issues/2908
          router: {
            asPath: ctx.asPath,
            pathname: ctx.pathname,
            query: ctx.query,
          },
        },
      )
    } catch (error) {
      // Prevent Apollo Client GraphQL errors from crashing SSR.
      // Handle them in components via the data.error prop:
      // http://dev.apollodata.com/react/api-queries.html#graphql-query-data-error
      console.error('Error while running `getDataFromTree`', error)
    }

    if (!process.browser) {
      // getDataFromTree does not call componentWillUnmount
      // head side effect therefore need to be cleared manually
      Head.rewind()
    }

    // Extract query data from the Apollo store
    apolloState.data = apollo.cache.extract()

    return {
      ...appProps,
      apolloState,
    }
  }

    static displayName = 'withApollo(App)'

    constructor(props) {
      super(props)
      // `getDataFromTree` renders the component first, the client is passed off as a property.
      // After that rendering is done using Next's normal rendering pipeline
      this.apolloClient = props.apolloClient || initApollo(props.apolloState.data)
    }

    render() {
      return <App {...this.props} apolloClient={this.apolloClient} />
    }
}
