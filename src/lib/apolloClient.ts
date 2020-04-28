/* eslint-disable import/no-extraneous-dependencies */

import fetch from 'isomorphic-unfetch'
import getConfig from 'next/config'
import Router from 'next/router'
import { ApolloClient } from 'apollo-client'
import { BatchHttpLink } from 'apollo-link-batch-http'
import { onError } from 'apollo-link-error'
import { ApolloLink, split } from 'apollo-link'
import { WebSocketLink } from 'apollo-link-ws'
import { SubscriptionClient } from 'subscriptions-transport-ws'
import { InMemoryCache, IntrospectionFragmentMatcher, NormalizedCacheObject } from 'apollo-cache-inmemory'
import { getMainDefinition } from 'apollo-utilities'

import introspectionQueryResultData from '../fragmentTypes.json'

export default function createApolloClient(initialState, ctx): ApolloClient<NormalizedCacheObject> {
  const { publicRuntimeConfig, serverRuntimeConfig } = getConfig()

  const isBrowser = typeof window !== 'undefined'

  const fragmentMatcher = new IntrospectionFragmentMatcher({
    introspectionQueryResultData,
  })

  const cache = new InMemoryCache({
    addTypename: true,
    dataIdFromObject: (o): string => o.id,
    fragmentMatcher,
  }).restore(initialState || {})

  // initialize the basic http link for both SSR and client-side usage
  let httpLink: any = new BatchHttpLink({
    credentials: 'include', // Additional fetch() options like `credentials` or `headers`
    fetch,
    uri: isBrowser
      ? publicRuntimeConfig.apiUrl
      : serverRuntimeConfig.apiUrlSSR || publicRuntimeConfig.apiUrl || 'http://localhost:4000/graphql',
  })

  // on the client, differentiate between websockets and http requests
  if (isBrowser) {
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
        const { kind, operation } = getMainDefinition(query) as any
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

          // redirect the user to the login page on errors
          if (isBrowser && (extensions.code === 'UNAUTHENTICATED' || extensions.code === 'INTERNAL_SERVER_ERROR')) {
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
    connectToDevTools: isBrowser,
    link: persistedQueryLink ? persistedQueryLink.concat(link) : link,
    ssrMode: Boolean(ctx), // Disables forceFetch on the server (so queries are only run once)
  })
}
