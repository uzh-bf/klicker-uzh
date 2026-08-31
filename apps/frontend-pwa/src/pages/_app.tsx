import { ApolloProvider } from '@apollo/client'
import { Capacitor } from '@capacitor/core'
import {
  ActionPerformed,
  PushNotificationSchema,
  PushNotifications,
  Token,
} from '@capacitor/push-notifications'
import { config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'
import PwaFeatureFlagProvider from '@components/featureFlags/PwaFeatureFlagProvider'
import { getMessageFallback, onError, routing } from '@klicker-uzh/i18n'
import { sourceSansPro } from '@klicker-uzh/shared-components/src/font'
import { useApollo } from '@lib/apollo'
import { init } from '@socialgouv/matomo-next'
import { Toaster } from '@uzh-bf/design-system'
import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import { Locale, NextIntlClientProvider } from 'next-intl'
import { useEffect } from 'react'

import '../globals.css'

config.autoAddCss = false

const MATOMO_URL = process.env.NEXT_PUBLIC_MATOMO_URL
const MATOMO_SITE_ID = process.env.NEXT_PUBLIC_MATOMO_SITE_ID

function App({ Component, pageProps }: AppProps) {
  const { locale } = useRouter()

  const apolloClient = useApollo(pageProps)

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
          <PwaFeatureFlagProvider>
            <Component {...pageProps} />
          </PwaFeatureFlagProvider>
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
