/* eslint-disable import/no-extraneous-dependencies */
// https://github.com/zeit/next.js/blob/canary/examples/with-apollo/lib/initApollo.js
// websockets: https://github.com/zeit/next.js/issues/3261
import 'isomorphic-unfetch'
import getConfig from 'next/config'
import Router from 'next/router'

import { ApolloClient } from 'apollo-client'
import { BatchHttpLink } from 'apollo-link-batch-http'
import { onError } from 'apollo-link-error'
import { ApolloLink, split } from 'apollo-link'
import { WebSocketLink } from 'apollo-link-ws'
import { SubscriptionClient } from 'subscriptions-transport-ws'
import { InMemoryCache } from 'apollo-cache-inmemory'
import { getMainDefinition } from 'apollo-utilities'
// import { withClientState } from 'apollo-link-state'

const { publicRuntimeConfig, serverRuntimeConfig } = getConfig()

let apolloClient = null

function create(initialState) {
  const cache = new InMemoryCache({
    addTypename: true,
    dataIdFromObject: o => o.id,
  }).restore(initialState || {})

  // initialize the basic http link for both SSR and client-side usage
  let httpLink = new BatchHttpLink({
    credentials: 'include', // Additional fetch() options like `credentials` or `headers`
    uri: process.browser
      ? publicRuntimeConfig.apiUrl
      : serverRuntimeConfig.apiUrlSSR || publicRuntimeConfig.apiUrl || 'http://localhost:4000/graphql',
  })

  // on the client, differentiate between websockets and http requests
  if (process.browser) {
    // instantiate a basic subscription client
    const wsClient = new SubscriptionClient(publicRuntimeConfig.apiUrlWS || 'ws://localhost:4000/graphql', {
      reconnect: true,
    })

    // create a websocket link from the client
    const wsLink = new WebSocketLink(wsClient)

    // swap out the http link with a split based on operation type
    // use websocket link for subscriptions, http link for remainder
    httpLink = split(
      ({ query }) => {
        const { kind, operation } = getMainDefinition(query)
        return kind === 'OperationDefinition' && operation === 'subscription'
      },
      wsLink,
      httpLink
    )
  }

  const link = ApolloLink.from([
    /* withClientState({
      cache,
      resolvers: {
        // TODO: add useful resolvers for local state
      },
    }), */
    onError(({ graphQLErrors, networkError }) => {
      if (graphQLErrors) {
        // TODO: log errors to sentry?
        graphQLErrors.forEach(({ message, path, locations, extensions }) => {
          console.log(`[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`)

          if (process.browser && extensions.code === 'UNAUTHENTICATED') {
            Router.push('/user/login?expired=true')
          }
        })
      }

      if (networkError) {
        console.log(`[Network error]: ${networkError}`)
      }
    }),
    httpLink,
  ])

  // setup APQ if configured appropriately
  let persistedQueryLink
  if (publicRuntimeConfig.persistQueries) {
    const { createPersistedQueryLink } = require('apollo-link-persisted-queries')
    persistedQueryLink = createPersistedQueryLink({
      generateHash: ({ documentId }) => documentId,
    })
  }

  return new ApolloClient({
    cache,
    connectToDevTools: process.browser,
    link: persistedQueryLink ? persistedQueryLink.concat(link) : link,
    ssrMode: !process.browser, // Disables forceFetch on the server (so queries are only run once)
  })
}

export default function initApollo(initialState) {
  // Make sure to create a new client for every server-side request so that data
  // isn't shared between connections (which would be bad)
  if (!process.browser) {
    return create(initialState)
  }

  // Reuse client on the client-side
  if (!apolloClient) {
    apolloClient = create(initialState)
  }

  return apolloClient
}
