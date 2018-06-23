/* eslint-disable import/no-extraneous-dependencies */
// https://github.com/zeit/next.js/blob/canary/examples/with-apollo/lib/initApollo.js
// websockets: https://github.com/zeit/next.js/issues/3261

import { ApolloClient } from 'apollo-client'
import { BatchHttpLink } from 'apollo-link-batch-http'
import { onError } from 'apollo-link-error'
import { withClientState } from 'apollo-link-state'
import { ApolloLink, split } from 'apollo-link'
import { WebSocketLink } from 'apollo-link-ws'
import { SubscriptionClient } from 'subscriptions-transport-ws'

// import { createPersistedQueryLink } from 'apollo-link-persisted-queries'
import { InMemoryCache } from 'apollo-cache-inmemory'
import fetch from 'isomorphic-unfetch'
import { getMainDefinition } from 'apollo-utilities'

const ssrMode = !process.browser
let apolloClient = null

// Polyfill fetch() on the server (used by apollo-client)
if (ssrMode) {
  global.fetch = fetch
}

// HACK: this is a copy of the default persisted-queries disable function
// it needs to be provided as the config passed in is not yet merged with defaults
// otherwise it would lead to ".disable not defined" style errors...
/* const defaultDisable = ({ graphQLErrors, operation }) => {
  // if the server doesn't support persisted queries, don't try anymore
  if (
    graphQLErrors &&
    graphQLErrors.some(({ message }) => message === 'PersistedQueryNotSupported')
  ) {
    return true
  }

  const { response } = operation.getContext()
  // if the server responds with bad request
  // apollo-server responds with 400 for GET and 500 for POST when no query is found
  if (response && response.status && (response.status === 400 || response.status === 500)) {
    return true
  }

  return false
} */

function create(initialState) {
  const cache = new InMemoryCache({
    addTypename: true,
    dataIdFromObject: o => o.id,
  }).restore(initialState || {})

  // initialize the basic http link for both SSR and client-side usage
  let httpLink = new BatchHttpLink({
    credentials: 'include', // Additional fetch() options like `credentials` or `headers`
    uri: process.env.API_URL || 'http://localhost:4000/graphql',
  })

  // on the client, differentiate between websockets and http requests
  if (!ssrMode) {
    // instantiate a basic subscription client
    const wsClient = new SubscriptionClient(
      process.env.API_URL_WS || 'ws://localhost:4000/subscriptions',
      {
        // TODO: include JWT
        /* connectionParams: {
        authToken: user.authToken,
      }, */
        reconnect: true,
      },
    )

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
      httpLink,
    )
  }

  const link = ApolloLink.from([
    withClientState({
      cache,
      resolvers: {
        // TODO: add useful resolvers for local state
      },
    }),
    onError(({ graphQLErrors, networkError }) => {
      if (graphQLErrors) {
        // TODO: log errors to sentry?
        graphQLErrors.map(({ message, locations, path }) => console.log(
          `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`,
        ),
        )
      }
      if (networkError) console.log(`[Network error]: ${networkError}`)
    }),
    httpLink,
  ])

  /* const persistQueriesLink = createPersistedQueryLink({
    // we need to pass both disable and generateHash (or it will bug)
    disable: defaultDisable,
    generateHash: ({ documentId }) => documentId,
  }) */

  return new ApolloClient({
    cache,
    connectToDevTools: process.browser,
    link,
    // link: persistQueriesLink.concat(link),
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
