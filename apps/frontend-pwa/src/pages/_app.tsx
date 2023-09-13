import { ApolloProvider } from '@apollo/client'
import {
  ActionPerformed,
  PushNotificationSchema,
  PushNotifications,
  Token,
} from '@capacitor/push-notifications'
import { config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'
import { getMessageFallback, onError } from '@klicker-uzh/i18n'
import { sourceSansPro } from '@klicker-uzh/shared-components/src/font'
import { useApollo } from '@lib/apollo'
import { init } from '@socialgouv/matomo-next'
import { NextIntlProvider } from 'next-intl'
import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import ErrorBoundary from '../components/ErrorBoundary'

import { Capacitor } from '@capacitor/core'
import '../globals.css'

config.autoAddCss = false

const MATOMO_URL = process.env.NEXT_PUBLIC_MATOMO_URL
const MATOMO_SITE_ID = process.env.NEXT_PUBLIC_MATOMO_SITE_ID

function App({ Component, pageProps }: AppProps) {
  const { locale } = useRouter()

  const apolloClient = useApollo(pageProps)

  useEffect(() => {
    if (MATOMO_URL && MATOMO_SITE_ID) {
      init({ url: MATOMO_URL, siteId: MATOMO_SITE_ID })
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

  return (
    <div id="__app" className={`${sourceSansPro.variable} font-sans`}>
      <ErrorBoundary>
        <NextIntlProvider
          messages={pageProps.messages}
          locale={locale}
          onError={onError}
          getMessageFallback={getMessageFallback}
        >
          <ApolloProvider client={apolloClient}>
            <Component {...pageProps} />
          </ApolloProvider>
        </NextIntlProvider>
      </ErrorBoundary>
      <style jsx global>{`
        :root {
          --source-sans-pro: ${sourceSansPro.variable};
          --theme-font-primary: ${sourceSansPro.variable};
        }

        #__app {
          min-height: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
      `}</style>
    </div>
  )
}

export default App
