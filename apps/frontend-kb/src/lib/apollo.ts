import {
  ApolloClient,
  ApolloLink,
  HttpLink,
  InMemoryCache,
  NormalizedCacheObject,
  from,
} from '@apollo/client'
import { onError } from '@apollo/client/link/error'
import Router from 'next/router'
import { useMemo } from 'react'

let apolloClient: ApolloClient<NormalizedCacheObject> | undefined

function createApolloLink() {
  const isBrowser = typeof window !== 'undefined'

  const errorLink = onError(({ graphQLErrors }) => {
    graphQLErrors?.forEach(({ message }) => {
      if (isBrowser && message === 'Unauthorized') {
        Router.push(
          `/login?expired=true&redirect_to=${encodeURIComponent(
            window.location.pathname + window.location.search
          )}`
        )
      }
    })
  })

  const httpLink = new HttpLink({
    uri: isBrowser
      ? process.env.NEXT_PUBLIC_API_URL
      : process.env.API_URL_SSR ||
        process.env.NEXT_PUBLIC_API_URL_SSR ||
        process.env.NEXT_PUBLIC_API_URL,
    credentials: 'include',
    headers: {
      'x-graphql-yoga-csrf': 'true',
    },
  })

  return from([errorLink, httpLink]) as ApolloLink
}

function createApolloClient() {
  return new ApolloClient({
    ssrMode: typeof window === 'undefined',
    link: createApolloLink(),
    cache: new InMemoryCache(),
    connectToDevTools: process.env.NODE_ENV === 'development',
  })
}

export function initializeApollo() {
  const client = apolloClient ?? createApolloClient()

  if (typeof window === 'undefined') {
    return client
  }

  if (!apolloClient) {
    apolloClient = client
  }

  return client
}

export function useApollo() {
  return useMemo(() => initializeApollo(), [])
}
