import {
  ApolloClient,
  from,
  HttpLink,
  InMemoryCache,
  NormalizedCacheObject,
} from '@apollo/client'
import { onError } from '@apollo/client/link/error'
import { concatPagination } from '@apollo/client/utilities'
import merge from 'deepmerge'
import getConfig from 'next/config'
import Router from 'next/router'
import { equals } from 'ramda'
import { useMemo } from 'react'
import util from 'util'

export const APOLLO_STATE_PROP_NAME = '__APOLLO_STATE__'

let apolloClient: any

const { publicRuntimeConfig } = getConfig()

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
        if (typeof window !== 'undefined' && message === 'Unauthorized!') {
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
  if (networkError) console.log(`[Network error]: ${networkError}`)
})

const httpLink = new HttpLink({
  uri: publicRuntimeConfig.API_URL,
  credentials: 'include',
})

function createApolloClient() {
  return new ApolloClient({
    ssrMode: typeof window === 'undefined',
    link: from([errorLink, httpLink]),
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            allPosts: concatPagination(),
          },
        },
      },
    }),
  })
}

export function initializeApollo(
  initialState = null
): ApolloClient<NormalizedCacheObject> {
  const _apolloClient = apolloClient ?? createApolloClient()

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

export function addApolloState(client: any, pageProps: any) {
  if (pageProps?.props) {
    pageProps.props[APOLLO_STATE_PROP_NAME] = client.cache.extract()
  }

  return pageProps
}

export function useApollo(pageProps: any) {
  const state = pageProps[APOLLO_STATE_PROP_NAME]
  const store = useMemo(() => initializeApollo(state), [state])
  return store
}
