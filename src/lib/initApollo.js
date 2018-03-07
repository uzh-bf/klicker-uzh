/* eslint-disable import/no-extraneous-dependencies */
// https://github.com/zeit/next.js/blob/canary/examples/with-apollo/lib/initApollo.js

import { ApolloClient } from 'apollo-client'
import { HttpLink } from 'apollo-link-http'
// import { createPersistedQueryLink } from 'apollo-link-persisted-queries'
import { InMemoryCache } from 'apollo-cache-inmemory'
import fetch from 'isomorphic-unfetch'

let apolloClient = null

// Polyfill fetch() on the server (used by apollo-client)
if (!process.browser) {
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

  const link = new HttpLink({
    credentials: 'include', // Additional fetch() options like `credentials` or `headers`
    uri: process.env.API_URL || 'http://localhost:4000/graphql',
  })

  /* const persistQueriesLink = createPersistedQueryLink({
    // we need to pass both disable and generateHash (or it will bug)
    disable: defaultDisable,
    generateHash: ({ documentId }) => documentId,
  }) */

  const client = new ApolloClient({
    cache,
    connectToDevTools: process.browser,
    link,
    // link: persistQueriesLink.concat(link),
    ssrMode: !process.browser, // Disables forceFetch on the server (so queries are only run once)
  })

  return client
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
