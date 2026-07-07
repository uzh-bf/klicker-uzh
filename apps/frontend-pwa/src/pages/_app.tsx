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
import { getMessageFallback, onError, routing } from '@klicker-uzh/i18n'
import { sourceSansPro } from '@klicker-uzh/shared-components/src/font'
import useAuditClient from '@klicker-uzh/shared-components/src/hooks/useAuditClient'
import { AuditAction, AuditScope } from '@klicker-uzh/types'
import { useApollo } from '@lib/apollo'
import { init } from '@socialgouv/matomo-next'
import { Button, Toaster } from '@uzh-bf/design-system'
import { Locale, NextIntlClientProvider } from 'next-intl'
import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import { useCallback, useEffect } from 'react'
import AssessmentErrorBoundary from '../components/common/AssessmentErrorBoundary'

import '../globals.css'

config.autoAddCss = false

const MATOMO_URL = process.env.NEXT_PUBLIC_MATOMO_URL
const MATOMO_SITE_ID = process.env.NEXT_PUBLIC_MATOMO_SITE_ID

const MAX_ERROR_FIELD_LENGTH = 4000

const trimDetail = (value?: string | null) => {
  if (!value) return undefined
  return value.length > MAX_ERROR_FIELD_LENGTH
    ? `${value.slice(0, MAX_ERROR_FIELD_LENGTH)}…`
    : value
}

function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const { locale } = router

  const isAssessmentMode = process.env.NEXT_PUBLIC_IS_ASSESSMENT === 'true'

  const apolloClient = useApollo(pageProps)

  const auditLog = useAuditClient({
    assessmentMode: isAssessmentMode,
    enabled: isAssessmentMode,
    onError: (error) => {
      console.warn('Failed to send audit event', error)
    },
  })

  const logClientError = useCallback(
    (details: {
      message: string
      stack?: string | null
      errorType: 'error' | 'unhandledrejection' | 'boundary'
      source?: string
      line?: number
      column?: number
      reason?: string
      componentStack?: string
    }) => {
      if (!isAssessmentMode) return

      const now = new Date()

      auditLog.logAsync({
        action: AuditAction.CLIENT_ERROR,
        scope: AuditScope.PUBLIC,
        resource: 'client:browser',
        attributes: {
          errorType: details.errorType,
          message: trimDetail(details.message),
          stack: trimDetail(details.stack ?? undefined),
          reason: trimDetail(details.reason),
          source: trimDetail(details.source),
          line: details.line,
          column: details.column,
          userAgent:
            typeof navigator !== 'undefined'
              ? trimDetail(navigator.userAgent)
              : undefined,
          url: typeof window !== 'undefined' ? window.location.href : undefined,
          timestamp: now.toISOString(),
          componentStack: trimDetail(details.componentStack),
        },
      })
    },
    [auditLog, isAssessmentMode]
  )

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

  useEffect(() => {
    if (!isAssessmentMode) return
    if (typeof window === 'undefined') return

    const handleError = (event: ErrorEvent) => {
      logClientError({
        errorType: 'error',
        message: event.message || 'Unhandled error',
        stack: event.error?.stack ?? null,
        source: event.filename ?? undefined,
        line: event.lineno ?? undefined,
        column: event.colno ?? undefined,
      })
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      let message = 'Unhandled promise rejection'
      let stack: string | null | undefined
      let reason: string | undefined

      if (event.reason instanceof Error) {
        message = event.reason.message
        stack = event.reason.stack
      } else if (event.reason) {
        try {
          reason = JSON.stringify(event.reason)
        } catch (_) {
          reason = String(event.reason)
        }
      }

      logClientError({
        errorType: 'unhandledrejection',
        message,
        stack: stack ?? null,
        reason,
      })
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [isAssessmentMode, logClientError])

  const renderAssessmentFallback = useCallback(
    ({ error, reset }: { error: Error | null; reset: () => void }) => {
      const handleRetry = () => {
        reset()
      }

      const handleReload = () => {
        if (typeof window !== 'undefined') {
          window.location.reload()
        }
      }

      return (
        <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-2xl font-semibold">
            Assessment temporarily unavailable
          </h1>
          <p className="max-w-xl text-sm text-gray-600">
            We could not display this assessment screen. You can try again or
            reload the page to continue.
          </p>
          {error?.message ? (
            <pre className="max-w-xl overflow-x-auto rounded bg-gray-100 p-3 text-left text-xs text-gray-700">
              {error.message}
            </pre>
          ) : null}
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={handleRetry} variant="primary">
              Try again
            </Button>
            <Button onClick={handleReload} variant="secondary">
              Reload page
            </Button>
          </div>
        </div>
      )
    },
    []
  )

  // ensure locale is one of the supported locales
  const validLocale = routing.locales.includes(locale as Locale)
    ? (locale as (typeof routing.locales)[number])
    : routing.defaultLocale

  const pageComponent = <Component key={router.asPath} {...pageProps} />

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
          {isAssessmentMode ? (
            <AssessmentErrorBoundary
              onError={(error, info) => {
                logClientError({
                  errorType: 'boundary',
                  message: error?.message ?? 'Assessment boundary error',
                  stack: error?.stack ?? null,
                  componentStack: trimDetail(info.componentStack),
                })
              }}
              fallback={renderAssessmentFallback}
            >
              {pageComponent}
            </AssessmentErrorBoundary>
          ) : (
            pageComponent
          )}
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
