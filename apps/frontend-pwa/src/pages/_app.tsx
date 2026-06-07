import { ApolloProvider } from '@apollo/client'
import type { URLOpenListenerEvent } from '@capacitor/app'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import type { ActionPerformed } from '@capacitor/push-notifications'
import { PushNotifications } from '@capacitor/push-notifications'
import { config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'
import { getMessageFallback, onError, routing } from '@klicker-uzh/i18n'
import { sourceSansPro } from '@klicker-uzh/shared-components/src/font'
import { useApollo } from '@lib/apollo'
import { init } from '@socialgouv/matomo-next'
import { Toaster } from '@uzh-bf/design-system'
import { Locale, NextIntlClientProvider } from 'next-intl'
import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

import '../globals.css'

config.autoAddCss = false

const MATOMO_URL = process.env.NEXT_PUBLIC_MATOMO_URL
const MATOMO_SITE_ID = process.env.NEXT_PUBLIC_MATOMO_SITE_ID
const KLICKER_APP_HOSTS = new Set([
  'pwa.klicker.com',
  'assessment.klicker.com',
  'pwa.klicker.uzh.ch',
  'assessment.klicker.uzh.ch',
])

function hasRedirectParam(search: string) {
  const searchParams = new URLSearchParams(search)

  return searchParams.has('redirect_to') || searchParams.has('redirectTo')
}

function getInternalKlickerPath(
  url: string,
  {
    rejectRedirectParams = false,
  }: {
    rejectRedirectParams?: boolean
  } = {}
) {
  const trimmedUrl = url.trim()

  if (trimmedUrl.startsWith('/') && !trimmedUrl.startsWith('//')) {
    const [, search = ''] = trimmedUrl.split('?')

    if (rejectRedirectParams && hasRedirectParam(search.split('#')[0] ?? '')) {
      return null
    }

    return trimmedUrl.replace(/^\/+/, '/')
  }

  try {
    const parsedUrl = new URL(trimmedUrl)

    if (!KLICKER_APP_HOSTS.has(parsedUrl.hostname)) {
      return null
    }

    const pathname = parsedUrl.pathname.replace(/^\/+/, '/')

    if (rejectRedirectParams && hasRedirectParam(parsedUrl.search)) {
      return null
    }

    return `${pathname}${parsedUrl.search}${parsedUrl.hash}`
  } catch {
    return null
  }
}

function getPushActionUrl(notification: ActionPerformed) {
  const data = notification.notification.data

  if (!data || typeof data !== 'object') {
    return null
  }

  const targetUrl = data.url ?? data.deepLink ?? data.link

  return typeof targetUrl === 'string' ? targetUrl : null
}

function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const { locale } = router

  const apolloClient = useApollo(pageProps)

  useEffect(() => {
    if (MATOMO_URL && MATOMO_SITE_ID) {
      init({ url: MATOMO_URL, siteId: MATOMO_SITE_ID })
    }
  }, [])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return
    }

    let listenerHandles: { remove: () => Promise<void> }[] = []
    let removed = false

    async function setupNativeRoutingListeners() {
      const handles: { remove: () => Promise<void> }[] = []

      try {
        const appUrlHandle = await CapacitorApp.addListener(
          'appUrlOpen',
          (event: URLOpenListenerEvent) => {
            const path = getInternalKlickerPath(event.url)

            if (path) {
              void router.push(path)
            }
          }
        )
        handles.push(appUrlHandle)

        const notificationActionHandle = await PushNotifications.addListener(
          'pushNotificationActionPerformed',
          (event: ActionPerformed) => {
            const targetUrl = getPushActionUrl(event)

            if (!targetUrl) {
              return
            }

            const path = getInternalKlickerPath(targetUrl, {
              rejectRedirectParams: true,
            })

            if (path) {
              void router.push(path)
            }
          }
        )
        handles.push(notificationActionHandle)
      } catch (e) {
        await Promise.all(handles.map((handle) => handle.remove()))
        throw e
      }

      if (removed) {
        await Promise.all(handles.map((handle) => handle.remove()))
        return
      }

      listenerHandles = handles
    }

    void setupNativeRoutingListeners().catch((e) => {
      console.error('Failed to setup native routing listeners:', e)
    })

    return () => {
      removed = true
      listenerHandles.forEach((handle) => {
        void handle.remove()
      })
    }
  }, [router])

  // ensure locale is one of the supported locales
  const validLocale = routing.locales.includes(locale as Locale)
    ? (locale as (typeof routing.locales)[number])
    : routing.defaultLocale

  return (
    <div
      id="__app"
      className={`flex h-full min-h-full flex-col bg-white ${sourceSansPro.variable} font-sans`}
    >
      <NextIntlClientProvider
        timeZone="Europe/Zurich"
        messages={pageProps.messages}
        locale={validLocale}
        onError={onError}
        getMessageFallback={getMessageFallback}
      >
        <ApolloProvider client={apolloClient}>
          <Toaster closeButton position="top-right" />
          <Component {...pageProps} />
        </ApolloProvider>
      </NextIntlClientProvider>
      <style jsx global>{`
        :root {
          --source-sans-pro: ${sourceSansPro.variable};
          --theme-font-primary: ${sourceSansPro.variable};
        }
      `}</style>
    </div>
  )
}

export default App
