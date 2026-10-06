import {
  ApolloClient,
  ApolloLink,
  from,
  HttpLink,
  InMemoryCache,
  NormalizedCacheObject,
  Observable,
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
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { isDeepEqual } from 'remeda'
import util from 'util'
import {
  participantDataUseReturn,
  storeDataUseReturnTarget,
} from './participantDataUseReturn'
import {
  applyParticipantPageSession,
  getParticipantSessionRevision,
  getParticipantSessionToken,
  isSuccessfulParticipantSessionResult,
  observeParticipantSessionResult,
  type ParticipantPageSession,
  projectParticipantPageSession,
  subscribeParticipantSession,
} from './participantSession'

interface PageProps extends ParticipantPageSession {
  __APOLLO_STATE__: NormalizedCacheObject
  props?: Record<string, any>
}

export const APOLLO_STATE_PROP_NAME = '__APOLLO_STATE__'

let apolloClient: ApolloClient<NormalizedCacheObject> | undefined
let apolloSessionRevision = -1

interface ParticipantClientScope {
  token: string | null
  revision: number
  baseRevision: number
  retired: boolean
}

let activeParticipantScope: ParticipantClientScope | undefined

function isActiveParticipantScope(scope: ParticipantClientScope) {
  return (
    !scope.retired &&
    activeParticipantScope === scope &&
    scope.revision === getParticipantSessionRevision() &&
    scope.token === getParticipantSessionToken()
  )
}

function createIsomorphLink(
  ctx?: GetServerSidePropsContext,
  scope?: ParticipantClientScope
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
      let token = scope ? scope.token : getParticipantSessionToken()
      if (process.env.NEXT_PUBLIC_IS_ASSESSMENT === 'true') {
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
        participantSessionRevision:
          scope?.revision ?? getParticipantSessionRevision(),
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

  const sessionResultLink = new ApolloLink((operation, forward) => {
    const revision = getParticipantSessionRevision()
    return forward(operation).map((result) => {
      if (
        isBrowser &&
        process.env.NEXT_PUBLIC_IS_ASSESSMENT !== 'true' &&
        (scope
          ? isActiveParticipantScope(scope)
          : revision === getParticipantSessionRevision())
      ) {
        if (scope && isSuccessfulParticipantSessionResult(result))
          scope.retired = true
        observeParticipantSessionResult(result)
      }
      return result
    })
  })

  const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
    if (
      isBrowser &&
      process.env.NEXT_PUBLIC_IS_ASSESSMENT !== 'true' &&
      (scope
        ? !isActiveParticipantScope(scope)
        : operation.getContext().participantSessionRevision !==
          getParticipantSessionRevision())
    )
      return
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

    const scopeLink = new ApolloLink((operation, forward) => {
      if (
        scope &&
        (scope.retired ||
          (!isActiveParticipantScope(scope) &&
            (activeParticipantScope === scope ||
              scope.baseRevision !== getParticipantSessionRevision())))
      ) {
        return new Observable((observer) => {
          observer.error(new Error('Participant session changed'))
        })
      }
      return forward(operation)
    })

    return from([
      retryLink,
      errorLink,
      scopeLink,
      sessionResultLink,
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
  scope?: ParticipantClientScope
) {
  // TODO: switch to yoga link
  // const yogaLink = new YogaLink({
  //   endpoint: publicRuntimeConfig.API_URL,
  //   credentials: true
  // })

  return new ApolloClient({
    ssrMode: typeof window === 'undefined',
    link: createIsomorphLink(ctx, scope),
    cache: new InMemoryCache(),
    connectToDevTools: process.env.NODE_ENV === 'development',
  })
}

export function initializeApollo(
  initialState?: NormalizedCacheObject,
  ctx?: GetServerSidePropsContext
): ApolloClient<NormalizedCacheObject> {
  const browser = typeof window !== 'undefined'
  const revision = getParticipantSessionRevision()
  const sessionChanged =
    browser && !!apolloClient && revision !== apolloSessionRevision
  if (sessionChanged) {
    apolloClient!.stop()
    apolloClient = undefined
  }
  const _apolloClient =
    (browser ? apolloClient : undefined) ?? createApolloClient(ctx)

  // If your page has Next.js data fetching methods that use Apollo Client, the initial state
  // gets hydrated here
  if (initialState && !sessionChanged) {
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
  if (!apolloClient) apolloClient = _apolloClient
  apolloSessionRevision = revision

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

interface ParticipantClientCandidate {
  client: ApolloClient<NormalizedCacheObject>
  scope: ParticipantClientScope
  initialState?: NormalizedCacheObject
}

function createParticipantClientCandidate(
  token: string | null,
  revision: number,
  initialState?: NormalizedCacheObject,
  previous?: ParticipantClientCandidate | null
): ParticipantClientCandidate {
  const scope: ParticipantClientScope = {
    token,
    revision,
    baseRevision: getParticipantSessionRevision(),
    retired: false,
  }
  const client = createApolloClient(undefined, scope)
  const existing =
    previous?.scope.token === token && previous.scope.revision === revision
      ? previous.client.extract()
      : {}
  client.cache.restore(
    merge(existing, initialState ?? {}, {
      arrayMerge: (destinationArray, sourceArray) => [
        ...sourceArray,
        ...destinationArray.filter((d) =>
          sourceArray.every((s) => !isDeepEqual(d, s))
        ),
      ],
    })
  )
  return { client, scope, initialState }
}

function retireParticipantClient(candidate: ParticipantClientCandidate) {
  candidate.scope.retired = true
  if (activeParticipantScope === candidate.scope)
    activeParticipantScope = undefined
  candidate.client.stop()
}

export function useApollo(pageProps: PageProps) {
  useSyncExternalStore(
    subscribeParticipantSession,
    getParticipantSessionRevision,
    () => 0
  )
  const regularBrowser =
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_IS_ASSESSMENT !== 'true'
  const session = projectParticipantPageSession(pageProps)
  const state = pageProps[APOLLO_STATE_PROP_NAME]
  const initialState =
    session.token === (pageProps.participantToken ?? null) &&
    !pageProps.resetParticipantSession &&
    pageProps.sessionState !== 'rejected' &&
    pageProps.sessionState !== 'registration_required' &&
    pageProps.sessionState !== 'exchange_unavailable'
      ? state
      : undefined
  const legacyClient = useMemo(
    () => (regularBrowser ? null : initializeApollo(state)),
    [regularBrowser, state]
  )
  const [rendered, setRendered] = useState(() =>
    regularBrowser
      ? createParticipantClientCandidate(
          session.token,
          session.revision,
          initialState
        )
      : null
  )
  let candidate = rendered
  if (
    regularBrowser &&
    (!candidate ||
      candidate.scope.retired ||
      (!isActiveParticipantScope(candidate.scope) &&
        candidate.scope.baseRevision !== session.baseRevision) ||
      candidate.scope.token !== session.token ||
      candidate.scope.revision !== session.revision ||
      candidate.initialState !== initialState)
  ) {
    // Adjust only this component's private client during render. Retained
    // credentials and the committed client change only after React commits.
    candidate = createParticipantClientCandidate(
      session.token,
      session.revision,
      initialState,
      rendered
    )
    setRendered(candidate)
  }

  const committed = useRef<ParticipantClientCandidate | null>(null)
  useEffect(() => {
    if (!candidate) return
    if (isActiveParticipantScope(candidate.scope)) {
      applyParticipantPageSession(pageProps, candidate.scope.revision)
      return
    }
    if (!applyParticipantPageSession(pageProps, candidate.scope.baseRevision)) {
      retireParticipantClient(candidate)
      return
    }
    const previous = committed.current
    committed.current = candidate
    activeParticipantScope = candidate.scope
    if (previous && previous !== candidate) retireParticipantClient(previous)
  }, [candidate, pageProps])

  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      queueMicrotask(() => {
        if (mounted.current) return
        const current = committed.current
        if (current) retireParticipantClient(current)
      })
    }
  }, [])

  return candidate?.client ?? legacyClient!
}
