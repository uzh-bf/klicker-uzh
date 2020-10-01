/* eslint-disable import/no-extraneous-dependencies */

import fetch from 'isomorphic-unfetch'
import getConfig from 'next/config'
import Router from 'next/router'
import { ApolloClient, ApolloLink, split, InMemoryCache } from '@apollo/client'
import { BatchHttpLink } from '@apollo/client/link/batch-http'
import { onError } from '@apollo/client/link/error'
import { WebSocketLink } from '@apollo/client/link/ws'
import { SubscriptionClient } from 'subscriptions-transport-ws'
import { getMainDefinition } from '@apollo/client/utilities'

export default function createApolloClient(initialState, ctx) {
  const { publicRuntimeConfig, serverRuntimeConfig } = getConfig()

  const isBrowser = typeof window !== 'undefined'

  const cache = new InMemoryCache({
    possibleTypes: {
      QuestionInstance_Results: ['SCQuestionResults', 'FREEQuestionResults'],
      QuestionOptions: ['SCQuestionOptions', 'FREEQuestionOptions'],
      QuestionOptions_Public: ['SCQuestionOptions_Public', 'FREEQuestionOptions_Public'],
    },
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

  return new ApolloClient({
    cache,
    connectToDevTools: isBrowser,
    link,
    ssrMode: Boolean(ctx), // Disables forceFetch on the server (so queries are only run once)
  })
}
