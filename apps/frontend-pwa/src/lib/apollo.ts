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
import {
  adoptFrameSession,
  assertParticipantSession,
  bindParticipantSession,
  completeParticipantSessionCommand,
  endFrameSession,
  frameSessionToken,
  isParticipantFrame,
  participantSessionHeaders,
  readParticipantSession,
} from '@klicker-uzh/shared-components/src/utils/participantSession'
import merge from 'deepmerge'
import { getOperationAST } from 'graphql'
import { usePregeneratedHashes } from 'graphql-codegen-persisted-query-ids/lib/apollo'
import { createClient } from 'graphql-ws'
import { GetServerSidePropsContext } from 'next'
import Router from 'next/router'
import { useMemo } from 'react'
import { isDeepEqual } from 'remeda'
import util from 'util'
import {
  participantDataUseReturn,
  storeDataUseReturnTarget,
} from './participantDataUseReturn'
import { isSuccessfulParticipantSessionResult } from './participantSession'

interface PageProps {
  sessionRevision?: string
  __APOLLO_STATE__: NormalizedCacheObject
  props?: Record<string, any>
}

export const APOLLO_STATE_PROP_NAME = '__APOLLO_STATE__'

// A browser client belongs to one shared session revision. Replacement
// retires the client so queued work and late results cannot cross identities.
interface ParticipantBinding {
  revision: string
  retired: boolean
}

let apolloClient: ApolloClient<NormalizedCacheObject> | undefined
let apolloBinding: ParticipantBinding | undefined

function completeSessionCommand(
  binding: ParticipantBinding,
  result: { data?: Record<string, any> | null }
) {
  const data = result.data ?? {}
  const created = data.createParticipantAccount?.participantToken
  const refused = binding.revision === readParticipantSession()
  if (refused && isParticipantFrame() && typeof created === 'string') {
    // A frame whose browser refused the new cookie keeps the account as its
    // own session.
    adoptFrameSession(created)
  } else if (
    frameSessionToken() &&
    (data.logoutParticipant || data.deleteParticipantAccount)
  ) {
    endFrameSession()
  } else if (refused) {
    void Router.replace('/serverError?cookiesRequired=true')
    throw new Error('Shared participant cookie was not accepted')
  }
  binding.retired = true
  completeParticipantSessionCommand()
  const retiredClient = apolloClient
  // Let the successful mutation reach its caller before disposal.
  setTimeout(() => {
    retiredClient?.stop()
    retiredClient?.cache.restore({})
  }, 0)
}

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
      if (binding)
        return {
          headers: {
            ...headers,
            authorization: '',
            ...participantSessionHeaders(),
          },
        }
      let token: string | null = null
      try {
        token = sessionStorage.getItem('participant_token')
      } catch {}
      return {
        headers: { ...headers, authorization: token ? `Bearer ${token}` : '' },
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

  // One guard binds every operation to this client's participant session. It
  // sits above the retry link, so neither a replaced session nor a refused
  // cookie is ever retried. A successful login, logout or account deletion
  // changes the identity, so the document retires before its caller navigates.
  const sessionLink = new ApolloLink(
    (operation, forward) =>
      new Observable((observer) => {
        try {
          if (binding?.retired) throw new Error('Participant session changed')
          if (binding) assertParticipantSession(binding.revision)
        } catch (error) {
          observer.error(error)
          return
        }
        const subscription = forward(operation).subscribe({
          next: (result) => {
            try {
              if (
                binding &&
                !binding.retired &&
                isSuccessfulParticipantSessionResult(result)
              ) {
                completeSessionCommand(binding, result)
              } else if (binding) {
                if (binding.retired)
                  throw new Error('Participant session changed')
                assertParticipantSession(binding.revision)
              }
            } catch (error) {
              observer.error(error)
              return
            }
            observer.next(result)
          },
          error: (error) => observer.error(error),
          complete: () => observer.complete(),
        })
        return () => subscription.unsubscribe()
      })
  )

  const errorLink = onError(({ graphQLErrors, networkError }) => {
    if (binding) {
      try {
        assertParticipantSession(binding.revision)
      } catch {
        return
      }
    }
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
        retryIf: (error) => {
          if (!error || binding?.retired) return false
          try {
            if (binding) assertParticipantSession(binding.revision)
            return true
          } catch {
            return false
          }
        },
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
      ...(binding ? [sessionLink] : []),
      retryLink,
      errorLink,
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
  return client
}

export function initializeApollo(
  initialState?: NormalizedCacheObject,
  ctx?: GetServerSidePropsContext,
  session?: Pick<ParticipantBinding, 'revision'>
): ApolloClient<NormalizedCacheObject> {
  const browser = typeof window !== 'undefined'
  // A different participant binding needs a client with an empty cache.
  if (browser && session && apolloBinding?.revision !== session.revision) {
    if (apolloBinding) apolloBinding.retired = true
    apolloClient?.stop()
    apolloClient = undefined
  }
  const binding =
    browser && session ? { ...session, retired: false } : undefined
  const _apolloClient =
    (browser ? apolloClient : undefined) ?? createApolloClient(ctx, binding)

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
    apolloBinding = binding
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
  if (regular) bindParticipantSession(pageProps.sessionRevision)
  return useMemo(
    () =>
      initializeApollo(
        !regular ||
          (!frameSessionToken() &&
            pageProps.sessionRevision === readParticipantSession())
          ? pageProps[APOLLO_STATE_PROP_NAME]
          : undefined,
        undefined,
        regular ? { revision: bindParticipantSession() } : undefined
      ),
    [regular, pageProps]
  )
}
