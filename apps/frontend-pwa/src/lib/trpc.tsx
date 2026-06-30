import type { AppRouter, RouterInputs, RouterOutputs } from '@klicker-uzh/api'
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import {
  createTRPCProxyClient,
  createWSClient,
  httpBatchLink,
  httpLink,
  splitLink,
  wsLink,
} from '@trpc/client'
import { createTRPCReact } from '@trpc/react-query'
import type { GetServerSidePropsContext } from 'next'
import Router from 'next/router'
import { type ReactNode, useState } from 'react'
import superjson from 'superjson'

export type { RouterInputs, RouterOutputs }

export const trpc = createTRPCReact<AppRouter>()
export const api = trpc
type FetchParameters = Parameters<typeof globalThis.fetch>
let pendingUnauthorizedRedirect: number | undefined

function getApiUrl() {
  return (
    (typeof window === 'undefined'
      ? process.env.API_URL_SSR ||
        process.env.NEXT_PUBLIC_API_URL_SSR ||
        process.env.NEXT_PUBLIC_API_URL
      : process.env.NEXT_PUBLIC_API_URL) ?? '/api/graphql'
  )
}

export function getTRPCUrl() {
  const apiUrl = getApiUrl()

  if (apiUrl.endsWith('/api/trpc')) return apiUrl
  if (apiUrl.endsWith('/api/graphql')) {
    return `${apiUrl.slice(0, -'/api/graphql'.length)}/api/trpc`
  }
  if (apiUrl.endsWith('/graphql')) {
    return `${apiUrl.slice(0, -'/graphql'.length)}/api/trpc`
  }

  return `${apiUrl.replace(/\/$/, '')}/api/trpc`
}

export function getTRPCWsUrl() {
  const trpcUrl = getTRPCUrl()
  const url =
    typeof window === 'undefined'
      ? trpcUrl
      : new URL(trpcUrl, window.location.origin).toString()

  return url.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://')
}

function getHeaders(
  ctx?: GetServerSidePropsContext,
  extraHeaders?: Record<string, string>
) {
  if (typeof window !== 'undefined') {
    const token = sessionStorage.getItem('participant_token')

    return token ? { authorization: `Bearer ${token}` } : {}
  }

  const cookie = ctx?.req?.headers.cookie

  return {
    ...(typeof cookie === 'string' ? { cookie } : {}),
    ...extraHeaders,
  }
}

function handleTRPCError(error: unknown) {
  if (typeof window === 'undefined') return

  if (!shouldRedirectToLogin(error)) return

  const pathAtError = getCurrentPath()
  sessionStorage.removeItem('participant_token')
  clearPendingUnauthorizedRedirect()
  pendingUnauthorizedRedirect = window.setTimeout(() => {
    pendingUnauthorizedRedirect = undefined

    if (getCurrentPath() !== pathAtError || pathAtError.startsWith('/login')) {
      return
    }

    Router.push(
      `/login?expired=true&redirect_to=${encodeURIComponent(pathAtError)}`
    )
  }, 100)
}

function shouldRedirectToLogin(error: unknown) {
  if (isUnauthorizedTRPCError(error)) {
    return true
  }

  return isForbiddenTRPCError(error) && window.location.pathname === '/'
}

function isUnauthorizedTRPCError(error: unknown) {
  return (
    getTRPCErrorCode(error) === 'UNAUTHORIZED' ||
    getTRPCErrorMessage(error) === 'Unauthorized'
  )
}

function isForbiddenTRPCError(error: unknown) {
  return (
    getTRPCErrorCode(error) === 'FORBIDDEN' ||
    getTRPCErrorMessage(error) === 'Forbidden'
  )
}

function getTRPCErrorCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('data' in error)) {
    return undefined
  }

  const data = error.data as { code?: unknown } | undefined

  return typeof data?.code === 'string' ? data.code : undefined
}

function getTRPCErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (!error || typeof error !== 'object' || !('message' in error)) {
    return undefined
  }

  const message = error.message

  return typeof message === 'string' ? message : undefined
}

function getCurrentPath() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

function clearPendingUnauthorizedRedirect() {
  if (typeof window === 'undefined' || !pendingUnauthorizedRedirect) return

  window.clearTimeout(pendingUnauthorizedRedirect)
  pendingUnauthorizedRedirect = undefined
}

export function createTRPCQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (shouldRedirectToLogin(error)) {
            handleTRPCError(error)
            return false
          }

          return failureCount < 3
        },
      },
    },
    queryCache: new QueryCache({
      onError: handleTRPCError,
    }),
    mutationCache: new MutationCache({
      onError: handleTRPCError,
    }),
  })
}

export function createTRPCClient(ctx?: GetServerSidePropsContext) {
  const httpLinkOptions = {
    url: getTRPCUrl(),
    headers: () => getHeaders(ctx),
    async fetch(url: FetchParameters[0], options: FetchParameters[1]) {
      const response = await globalThis.fetch(url, {
        ...options,
        credentials: 'include',
      })

      return response
    },
  }
  const batchedHttpLink = httpBatchLink(httpLinkOptions)
  const unbatchedHttpLink = httpLink(httpLinkOptions)
  const requestLink = splitLink({
    condition: (op) => op.type === 'mutation',
    true: unbatchedHttpLink,
    false: batchedHttpLink,
  })

  return trpc.createClient({
    transformer: superjson,
    links: [
      typeof window === 'undefined'
        ? requestLink
        : splitLink({
            condition: (op) => op.type === 'subscription',
            true: wsLink({
              client: createWSClient({
                url: getTRPCWsUrl,
              }),
            }),
            false: requestLink,
          }),
    ],
  })
}

export function createTRPCSSRClient(
  ctx?: GetServerSidePropsContext,
  extraHeaders?: Record<string, string>
) {
  return createTRPCProxyClient<AppRouter>({
    transformer: superjson,
    links: [
      httpBatchLink({
        url: getTRPCUrl(),
        headers: () => getHeaders(ctx, extraHeaders),
        fetch(url, options) {
          return globalThis.fetch(url, {
            ...options,
            credentials: 'include',
          })
        },
      }),
    ],
  })
}

export function TrpcProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createTRPCQueryClient)
  const [trpcClient] = useState(() => createTRPCClient())

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  )
}
