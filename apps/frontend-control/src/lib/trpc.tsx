import type { AppRouter, RouterInputs, RouterOutputs } from '@klicker-uzh/api'
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { httpBatchLink, httpLink, splitLink } from '@trpc/client'
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

function getHeaders(ctx?: GetServerSidePropsContext) {
  const cookie = ctx?.req?.headers.cookie

  return typeof cookie === 'string' ? { cookie } : {}
}

function handleTRPCError(error: unknown) {
  if (typeof window === 'undefined') return

  if (!isUnauthorizedTRPCError(error)) return

  const pathAtError = getCurrentPath()
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

function isUnauthorizedTRPCError(error: unknown) {
  return (
    getTRPCErrorCode(error) === 'UNAUTHORIZED' ||
    getTRPCErrorMessage(error) === 'Unauthorized'
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
          if (isUnauthorizedTRPCError(error)) {
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
      if (response.ok) {
        clearPendingUnauthorizedRedirect()
      }

      return response
    },
  }

  return trpc.createClient({
    transformer: superjson,
    links: [
      splitLink({
        condition: (op) => op.type === 'mutation',
        true: httpLink(httpLinkOptions),
        false: httpBatchLink(httpLinkOptions),
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
