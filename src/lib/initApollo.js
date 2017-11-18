import { ApolloClient, createNetworkInterface } from 'react-apollo'
import { PersistedQueryNetworkInterface } from 'persistgraphql'
import fetch from 'isomorphic-fetch'

import queryMap from '../graphql/queryMap.json'

const dev = process.env.NODE_ENV !== 'production'

let apolloClient = null

// Polyfill fetch() on the server (used by apollo-client)
if (!process.browser) {
  global.fetch = fetch
}

const networkOpts = {
  opts: {
    // Additional fetch() options like `credentials` or `headers`
    // credentials: dev ? 'include' : 'same-origin',
    // HACK: temporarily always include credentials
    credentials: 'include',
  },
  queryMap,
  // Server URL (must be absolute)
  // https://api.graph.cool/simple/v1/klicker
  // uri: 'http://localhost:4000/graphql',
  uri: process.env.API_URL || 'http://localhost',
}

function create() {
  return new ApolloClient({
    networkInterface: dev
      ? createNetworkInterface(networkOpts)
      : new PersistedQueryNetworkInterface(networkOpts),
    ssrMode: !process.browser, // Disables forceFetch on the server (so queries are only run once)
  })
}

export default function initApollo() {
  // Make sure to create a new client for every server-side request so that data
  // isn't shared between connections (which would be bad)
  if (!process.browser) {
    return create()
  }

  // Reuse client on the client-side
  if (!apolloClient) {
    apolloClient = create()
  }

  return apolloClient
}
