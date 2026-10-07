import {
  ApolloClient,
  ApolloLink,
  from,
  HttpLink,
  InMemoryCache,
  NormalizedCacheObject,
  split,
} from '@apollo/client'
import { setContext } from '@apollo/client/link/context'
import { onError } from '@apollo/client/link/error'
import { createPersistedQueryLink } from '@apollo/client/link/persisted-queries'
import { RetryLink } from '@apollo/client/link/retry'
import { GraphQLWsLink } from '@apollo/client/link/subscriptions'
import hashes from '@klicker-uzh/graphql/dist/client.json'
import merge from 'deepmerge'
import { getOperationAST } from 'graphql'
import { usePregeneratedHashes } from 'graphql-codegen-persisted-query-ids/lib/apollo'
import { createClient } from 'graphql-ws'
import { GetServerSidePropsContext } from 'next'
import Router from 'next/router'
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { isDeepEqual } from 'remeda'
import util from 'util'
import {
  participantDataUseReturn,
  storeDataUseReturnTarget,
} from './participantDataUseReturn'
import {
  applyParticipantPageSession,
  getParticipantSessionGeneration,
  getParticipantSessionVersion,
  invalidateParticipantSession,
  isSuccessfulParticipantSessionResult,
  type ParticipantPageSession,
  resolveParticipantPageToken,
  subscribeParticipantSession,
} from './participantSession'

interface PageProps extends ParticipantPageSession {
  __APOLLO_STATE__: NormalizedCacheObject
  props?: Record<string, any>
}

export const APOLLO_STATE_PROP_NAME = '__APOLLO_STATE__'

// A regular browser client is bound to one participant credential. Once that
// identity ends, the client is retired and its late results are ignored.
interface ParticipantBinding {
  token: string | null
  key: string
  retired: boolean
}

let apolloClient: ApolloClient<NormalizedCacheObject> | undefined
let apolloBinding: ParticipantBinding | undefined
const bindings = new WeakMap<
  ApolloClient<NormalizedCacheObject>,
  ParticipantBinding
>()

function createIsomorphLink(
  ctx?: GetServerSidePropsContext,
  binding?: ParticipantBinding
) {
  const isBrowser = typeof window !== 'undefined'

  const persistedLink =
    process.env.NODE_ENV === 'development'
      ? []
      : [
          split(
            ({ operationName }) => operationName === 'QGetVerifiableCredential',
            createPersistedQueryLink({
              useGETForHashedQueries: false,
              // eslint-disable-next-line react-hooks/rules-of-hooks
              generateHash: usePregeneratedHashes(hashes),
            }),
            createPersistedQueryLink({
              useGETForHashedQueries: true,
              // eslint-disable-next-line react-hooks/rules-of-hooks
              generateHash: usePregeneratedHashes(hashes),
            })
          ),
        ]

  const authLink = setContext((_, { headers }) => {
    if (isBrowser) {
      let token = binding?.token ?? null
      if (!binding) {
        // A partitioned or privacy-restricted browser context denies session
        // storage, and reading it throws. The cookie-authenticated participant
        // path has to keep working, so the bearer header is skipped instead of
        // failing the request before it reaches the API.

        try {
          token = sessionStorage.getItem('participant_token')
        } catch {
          token = null
        }
      }

      return {
        headers: {
          ...headers,
          authorization: token ? `Bearer ${token}` : '',
        },
      }
    }
    return {
      headers: {
        ...headers,
        ...(ctx?.req?.headers?.cookie
          ? { cookie: ctx.req.headers.cookie }
          : {}),
      },
    }
  })

  // A successful login, logout or account deletion changes the cookie
  // identity, so the client bound to the previous identity is replaced.
  const sessionResultLink = new ApolloLink((operation, forward) =>
    forward(operation).map((result) => {
      if (
        binding &&
        !binding.retired &&
        isSuccessfulParticipantSessionResult(result)
      ) {
        binding.retired = true
        invalidateParticipantSession()
      }
      return result
    })
  )

  const errorLink = onError(({ graphQLErrors, networkError }) => {
    if (binding?.retired) return
    if (graphQLErrors)
      graphQLErrors.forEach(({ message, locations, path, extensions }) => {
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
          )}`
        )

        if (
          isBrowser &&
          extensions?.code === 'PARTICIPANT_DATA_USE_COMPLETION_REQUIRED' &&
          Router.pathname !== '/account/data-use'
        ) {
          storeDataUseReturnTarget(
            participantDataUseReturn(
              window.location.href,
              window.location.origin
            )
          )
          void Router.replace('/account/data-use')
          return
        }

        // redirect the user to the login page on errors
        if (isBrowser && message === 'Unauthorized') {
          Router.push(
            `/login?expired=true&redirect_to=${
              encodeURIComponent(
                window?.location?.pathname + (window?.location?.search ?? '')
              ) ?? '/'
            }`
          )
        }
      })
    if (networkError) console.log(`[Network error]`, networkError)
  })

  let link: ApolloLink = new HttpLink({
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

    const wsLink = new GraphQLWsLink(
      createClient({
        url: (process.env.NEXT_PUBLIC_API_URL as string)
          .replace('http://', 'ws://')
          .replace('https://', 'wss://'),
        // connectionParams: () => {
        //   // Note: getSession() is a placeholder function created by you
        //   const session = getSession();
        //   if (!session) {
        //     return {};
        //   }
        //   return {
        //     Authorization: `Bearer ${session.token}`,
        //   };
        // },
      })
    )

    link = split(
      ({ query, operationName }) => {
        const definition = getOperationAST(query, operationName)
        return (
          definition?.kind === 'OperationDefinition' &&
          definition.operation === 'subscription'
        )
      },
      wsLink,
      link
    )

    return from([
      retryLink,
      errorLink,
      ...(binding ? [sessionResultLink] : []),
      authLink,
      ...persistedLink,
      link,
    ])
  }

  return from([errorLink, authLink, ...persistedLink, link])
}

// TODO: use the schema link when working on the server?
function createApolloClient(
  ctx?: GetServerSidePropsContext,
  binding?: ParticipantBinding
) {
  // TODO: switch to yoga link
  // const yogaLink = new YogaLink({
  //   endpoint: publicRuntimeConfig.API_URL,
  //   credentials: true
  // })

  const client = new ApolloClient({
    ssrMode: typeof window === 'undefined',
    link: createIsomorphLink(ctx, binding),
    cache: new InMemoryCache(),
    connectToDevTools: process.env.NODE_ENV === 'development',
  })
  if (binding) bindings.set(client, binding)
  return client
}

export function initializeApollo(
  initialState?: NormalizedCacheObject,
  ctx?: GetServerSidePropsContext,
  session?: Pick<ParticipantBinding, 'token' | 'key'>
): ApolloClient<NormalizedCacheObject> {
  const browser = typeof window !== 'undefined'
  // A different participant binding needs a client with an empty cache.
  if (browser && session && apolloBinding?.key !== session.key) {
    apolloClient = undefined
  }
  const _apolloClient =
    (browser ? apolloClient : undefined) ??
    createApolloClient(
      ctx,
      browser && session ? { ...session, retired: false } : undefined
    )

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
          sourceArray.every((s) => !isDeepEqual(d, s))
        ),
      ],
    })

    // Restore the cache with the merged data
    _apolloClient.cache.restore(data)
  }
  // For SSG and SSR always create a new Apollo Client
  if (typeof window === 'undefined') return _apolloClient
  // Create the Apollo Client once in the client
  if (!apolloClient) {
    apolloClient = _apolloClient
    apolloBinding = bindings.get(_apolloClient)
  }

  return _apolloClient
}

export function addApolloState(
  client: ApolloClient<NormalizedCacheObject>,
  pageProps: Omit<PageProps, '__APOLLO_STATE__'> & { revalidate?: number }
) {
  if (pageProps?.props) {
    pageProps.props[APOLLO_STATE_PROP_NAME] = client.cache.extract()
  }

  return pageProps
}

export function useApollo(pageProps: PageProps) {
  const regular =
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_IS_ASSESSMENT !== 'true'
  useSyncExternalStore(
    subscribeParticipantSession,
    getParticipantSessionVersion,
    () => 0
  )
  // The page's credential is resolved during render so that the first query
  // of a launch already carries it.
  const token = regular ? resolveParticipantPageToken(pageProps) : null
  const generation = getParticipantSessionGeneration()
  // Server-rendered data belongs to the page's cookie session, which a tab
  // holding another explicit credential must not show.
  const state =
    token &&
    pageProps.tokenSource === 'ambient' &&
    pageProps.participantToken !== token
      ? undefined
      : pageProps[APOLLO_STATE_PROP_NAME]
  const client = useMemo(
    () =>
      initializeApollo(
        state,
        undefined,
        regular ? { token, key: `${generation}:${token ?? ''}` } : undefined
      ),
    [regular, state, token, generation]
  )

  useEffect(() => {
    if (regular) applyParticipantPageSession(pageProps)
  }, [regular, pageProps])

  const previous = useRef(client)
  useEffect(() => {
    const replaced = previous.current
    previous.current = client
    if (replaced === client) return
    const binding = bindings.get(replaced)
    if (binding) binding.retired = true
    replaced.stop()
  }, [client])

  return client
}
