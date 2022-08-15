/* eslint-disable import/no-extraneous-dependencies */

import { ApolloClient, ApolloLink, InMemoryCache, split } from '@apollo/client'
import { BatchHttpLink } from '@apollo/client/link/batch-http'
import { onError } from '@apollo/client/link/error'
import { createPersistedQueryLink } from '@apollo/client/link/persisted-queries'
import { GraphQLWsLink } from '@apollo/client/link/subscriptions'
import { getMainDefinition } from '@apollo/client/utilities'
import { sha256 } from 'crypto-hash'
import { createClient } from 'graphql-ws'
import fetch from 'isomorphic-unfetch'
import getConfig from 'next/config'
import Router from 'next/router'

export default function createApolloClient() {
  const { publicRuntimeConfig, serverRuntimeConfig } = getConfig()

  const isBrowser = typeof window !== 'undefined'

  const cache = new InMemoryCache({
    possibleTypes: {
      QuestionInstance_Results: ['SCQuestionResults', 'FREEQuestionResults'],
      QuestionOptions: ['SCQuestionOptions', 'FREEQuestionOptions'],
      QuestionOptions_Public: ['SCQuestionOptions_Public', 'FREEQuestionOptions_Public'],
    },
  })

  // initialize the basic http link for both SSR and client-side usage
  let httpLink: any = createPersistedQueryLink({ sha256 }).concat(
    new BatchHttpLink({
      credentials: 'include', // Additional fetch() options like `credentials` or `headers`
      fetch,
      uri: isBrowser
        ? publicRuntimeConfig.apiUrl
        : serverRuntimeConfig.apiUrlSSR || publicRuntimeConfig.apiUrl || 'http://localhost:4000/graphql',
    })
  )

  // on the client, differentiate between websockets and http requests
  if (isBrowser) {
    // create a websocket link from the client
    const wsLink = new GraphQLWsLink(
      createClient({
        url: publicRuntimeConfig.apiUrlWS || 'ws://localhost:4000/graphql',
        // connectionParams: () => {
        // const session = getSession();
        // if (!session) {
        //   return {};
        // }
        // return {
        //   Authorization: `Bearer ${session.token}`,
        // };
        // },
      })
    )

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
        graphQLErrors.forEach(({ message, path, locations }) => {
          console.log(`[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`)

          // redirect the user to the login page on errors
          if (isBrowser && message === 'UNAUTHORIZED') {
            Router.push(
              `/user/login?expired=true&redirect_to=${
                encodeURIComponent(window?.location?.pathname + (window?.location?.search ?? '')) ?? '/questions'
              }`
            )
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
    ssrMode: !isBrowser,
  })
}
