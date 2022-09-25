import {
  ApolloClient,
  ApolloLink,
  from,
  HttpLink,
  InMemoryCache,
  NormalizedCacheObject,
  split,
} from '@apollo/client'
import { onError } from '@apollo/client/link/error'
import { RetryLink } from '@apollo/client/link/retry'
import merge from 'deepmerge'
import { getOperationAST } from 'graphql'
import { GetServerSidePropsContext } from 'next'
import getConfig from 'next/config'
import Router from 'next/router'
import { equals } from 'ramda'
import { useMemo } from 'react'
import util from 'util'
import SSELink from './SSELink'

interface PageProps {
  __APOLLO_STATE__?: NormalizedCacheObject
  props?: Record<string, any>
}

export const APOLLO_STATE_PROP_NAME = '__APOLLO_STATE__'

let apolloClient: ApolloClient<NormalizedCacheObject>

function createIsomorphLink() {
  const { publicRuntimeConfig, serverRuntimeConfig } = getConfig()

  const isBrowser = typeof window !== 'undefined'

  const errorLink = onError(({ graphQLErrors, networkError }) => {
    if (graphQLErrors)
      graphQLErrors.forEach(
        ({ message, locations, path, extensions, originalError }) => {
          console.log(
            `[GraphQL error]: Message: ${message}, Locations: ${util.inspect(
              locations,
              false,
              null,
              true
            )}, Path: ${path}, Extensions: ${util.inspect(
              extensions,
              false,
              null,
              true
            )}, Original: ${originalError}`
          )

          // redirect the user to the login page on errors
          if (isBrowser && message === 'Unauthorized!') {
            Router.push(
              `/login?expired=true&redirect_to=${
                encodeURIComponent(
                  window?.location?.pathname + (window?.location?.search ?? '')
                ) ?? '/'
              }`
            )
          }
        }
      )
    if (networkError) console.log(`[Network error]`, networkError)
  })

  let link: ApolloLink = new HttpLink({
    uri: isBrowser
      ? publicRuntimeConfig.API_URL
      : serverRuntimeConfig.API_URL_SSR || publicRuntimeConfig.API_URL,
    credentials: 'include',
  })

  if (isBrowser) {
    const retryLink = new RetryLink({
      delay: {
        initial: 1000,
        max: Infinity,
        jitter: true,
      },
      attempts: {
        max: 3,
      },
    })

    const sseLink = new SSELink({
      uri: publicRuntimeConfig.API_URL,
      withCredentials: true,
    })

    link = split(
      ({ query, operationName }) => {
        const definition = getOperationAST(query, operationName)
        return (
          definition?.kind === 'OperationDefinition' &&
          definition.operation === 'subscription'
        )
      },
      sseLink,
      link
    )

    return from([retryLink, errorLink, link])
  }

  return from([errorLink, link])
}

// TODO: use the schema link when working on the server?
function createApolloClient(ctx?: GetServerSidePropsContext) {
  // const yogaLink = new YogaLink({
  //   endpoint: publicRuntimeConfig.API_URL,
  //   credentials: true
  // })

  return new ApolloClient({
    ssrMode: typeof window === 'undefined',
    link: createIsomorphLink(),
    cache: new InMemoryCache(),
  })
}

export function initializeApollo(
  initialState?: NormalizedCacheObject,
  ctx?: GetServerSidePropsContext
): ApolloClient<NormalizedCacheObject> {
  const _apolloClient = apolloClient ?? createApolloClient(ctx)

  // If your page has Next.js data fetching methods that use Apollo Client, the initial state
  // gets hydrated here
  if (initialState) {
    // Get existing cache, loaded during client side data fetching
    const existingCache = _apolloClient.extract()

    // Merge the initialState from getStaticProps/getServerSideProps in the existing cache
    const data = merge(existingCache, initialState, {
      // combine arrays using object equality (like in sets)
      arrayMerge: (destinationArray, sourceArray) => [
        ...sourceArray,
        ...destinationArray.filter((d) =>
          sourceArray.every((s) => !equals(d, s))
        ),
      ],
    })

    // Restore the cache with the merged data
    _apolloClient.cache.restore(data)
  }
  // For SSG and SSR always create a new Apollo Client
  if (typeof window === 'undefined') return _apolloClient
  // Create the Apollo Client once in the client
  if (!apolloClient) apolloClient = _apolloClient

  return _apolloClient
}

export function addApolloState(
  client: ApolloClient<NormalizedCacheObject>,
  pageProps: PageProps
) {
  if (pageProps?.props) {
    pageProps.props[APOLLO_STATE_PROP_NAME] = client.cache.extract()
  }

  return pageProps
}

export function useApollo(pageProps: PageProps) {
  const state = pageProps[APOLLO_STATE_PROP_NAME]
  const store = useMemo(() => initializeApollo(state), [state])
  return store
}
