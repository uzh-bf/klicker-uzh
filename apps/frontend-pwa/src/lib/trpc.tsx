import type { AppRouter, RouterInputs, RouterOutputs } from '@klicker-uzh/api'
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import {
  TRPCClientError,
  createTRPCProxyClient,
  httpBatchLink,
} from '@trpc/client'
import { createTRPCReact } from '@trpc/react-query'
import type { GetServerSidePropsContext } from 'next'
import Router from 'next/router'
import { type ReactNode, useState } from 'react'
import superjson from 'superjson'

export type { RouterInputs, RouterOutputs }

export const trpc = createTRPCReact<AppRouter>()
export const api = trpc

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

  const isUnauthorized =
    error instanceof TRPCClientError
      ? error.data?.code === 'UNAUTHORIZED' || error.message === 'Unauthorized'
      : error instanceof Error && error.message === 'Unauthorized'

  if (!isUnauthorized) return

  Router.push(
    `/login?expired=true&redirect_to=${
      encodeURIComponent(
        window.location.pathname + (window.location.search ?? '')
      ) ?? '/'
    }`
  )
}

export function createTRPCQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: handleTRPCError,
    }),
    mutationCache: new MutationCache({
      onError: handleTRPCError,
    }),
  })
}

export function createTRPCClient(ctx?: GetServerSidePropsContext) {
  return trpc.createClient({
    transformer: superjson,
    links: [
      httpBatchLink({
        url: getTRPCUrl(),
        headers: () => getHeaders(ctx),
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
