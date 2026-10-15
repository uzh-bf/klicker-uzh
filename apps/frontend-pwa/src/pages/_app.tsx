import { ApolloProvider } from '@apollo/client'
import { Capacitor } from '@capacitor/core'
import {
  ActionPerformed,
  PushNotificationSchema,
  PushNotifications,
  Token,
} from '@capacitor/push-notifications'
import { config } from '@fortawesome/fontawesome-svg-core'
import ParticipantSessionBoundary from '@klicker-uzh/shared-components/src/ParticipantSessionBoundary'
import '@fortawesome/fontawesome-svg-core/styles.css'
import { getMessageFallback, onError, routing } from '@klicker-uzh/i18n'
import { sourceSansPro } from '@klicker-uzh/shared-components/src/font'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  adoptFrameSession,
  participantReloadUrl,
} from '@klicker-uzh/shared-components/src/utils/participantSession'
import { useApollo } from '@lib/apollo'
import { init } from '@socialgouv/matomo-next'
import { Toaster } from '@uzh-bf/design-system'
import { Locale, NextIntlClientProvider } from 'next-intl'
import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import { useCallback, useEffect } from 'react'

import 'katex/dist/katex.min.css'
import '../globals.css'

config.autoAddCss = false

const MATOMO_URL = process.env.NEXT_PUBLIC_MATOMO_URL
const MATOMO_SITE_ID = process.env.NEXT_PUBLIC_MATOMO_SITE_ID

function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const { locale } = router

  // The only navigation after an accepted launch: a page may name where the
  // participant continues; otherwise the consumed handoff leaves the URL.
  const sessionDestination: string | undefined = pageProps.sessionDestination
  const discardAcceptedHandoff = useCallback(() => {
    if (sessionDestination) {
      void router.replace(sessionDestination)
      return
    }
    const destination = participantReloadUrl()
    if (destination !== window.location.href) {
      void router.replace(destination, undefined, { shallow: true })
    }
  }, [router, sessionDestination])

  // Before the client exists: a frame session must authenticate its first
  // requests and must not hydrate data fetched without its credential.
  if (
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_IS_ASSESSMENT !== 'true'
  )
    adoptFrameSession(pageProps.frameToken)
  const apolloClient = useApollo(pageProps)
  const recovering =
    process.env.NEXT_PUBLIC_IS_ASSESSMENT !== 'true' &&
    (pageProps.sessionState === 'rejected' ||
      pageProps.sessionState === 'exchange_unavailable')
  useEffect(() => {
    // The rejected-launch navigation must win over the session boundary's
    // credential-stripped revision reload. A full navigation also rebinds the
    // page to the cookies the browser actually holds.
    if (recovering) {
      const prefix =
        locale && locale !== routing.defaultLocale ? `/${locale}` : ''
      window.location.replace(`${prefix}/serverError?freshLaunch=true`)
    }
  }, [recovering, locale])

  useEffect(() => {
    if (MATOMO_URL && MATOMO_SITE_ID) {
      init({
        url: MATOMO_URL,
        siteId: MATOMO_SITE_ID,
        excludeUrlsPatterns: [/\/verify(?:$|[?#])/],
      })
    }

    // if we are on iOS or android, register for push notifications
    if (
      Capacitor.getPlatform() === 'ios' ||
      Capacitor.getPlatform() === 'android'
    ) {
      PushNotifications.requestPermissions().then((result) => {
        if (result.receive === 'granted') {
          // Register with Apple / Google to receive push via APNS/FCM
          PushNotifications.register()
        } else {
          // Show some error
          console.error(result)
        }
      })

      // On success, we should be able to receive notifications
      PushNotifications.addListener('registration', (token: Token) => {
        console.log('Push registration success, token: ' + token.value)
      })

      // Some issue with our setup and push will not work
      PushNotifications.addListener('registrationError', (error: any) => {
        console.log('Error on registration: ' + JSON.stringify(error))
      })

      // Show us the notification payload if the app is open on our device
      PushNotifications.addListener(
        'pushNotificationReceived',
        (notification: PushNotificationSchema) => {
          console.log('Push received: ' + JSON.stringify(notification))
        }
      )

      // Method called when tapping on a notification
      PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (notification: ActionPerformed) => {
          console.log('Push action performed: ' + JSON.stringify(notification))
        }
      )
    }
  }, [])

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
          {process.env.NEXT_PUBLIC_IS_ASSESSMENT === 'true' ? (
            <Component {...pageProps} />
          ) : recovering ? (
            <Loader />
          ) : (
            <ParticipantSessionBoundary
              expectedRevision={pageProps.sessionRevision}
              requireCookie={pageProps.sessionEstablished}
              onSessionEstablished={discardAcceptedHandoff}
            >
              <Component {...pageProps} />
            </ParticipantSessionBoundary>
          )}
        </ApolloProvider>
      </NextIntlClientProvider>
      <style>{`
        :root {
          --source-sans-pro: ${sourceSansPro.variable};
          --theme-font-primary: ${sourceSansPro.variable};
        }
      `}</style>
    </div>
  )
}

export default App
