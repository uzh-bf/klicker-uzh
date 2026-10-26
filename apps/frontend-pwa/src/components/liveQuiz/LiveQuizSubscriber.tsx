import {
  type OperationVariables,
  type TypedDocumentNode,
  useApolloClient,
} from '@apollo/client'
import {
  GetRunningLiveQuizDocument,
  type GetRunningLiveQuizQuery,
  LiveQuizSettingsChangedDocument,
  RunningLiveQuizUpdatedDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { getSubscriptionConnection } from '@lib/apollo'
import { createLiveQuizRecovery } from '@lib/liveQuizRecovery'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

function LiveQuizSubscriber({ id }: { id: string }) {
  const client = useApolloClient()
  const t = useTranslations()
  const [status, setStatus] = useState<'ready' | 'synchronizing' | 'failed'>(
    'synchronizing'
  )
  const reconnect = useRef<() => void>(() => {})

  useEffect(() => {
    let active = true
    let operationGeneration = 0
    let operationFailed = false
    let authorizationFailed = false
    let subscriptions: { unsubscribe: () => void }[] = []
    let snapshotRequest: AbortController | undefined
    const connection = getSubscriptionConnection()
    const recovery = createLiveQuizRecovery({
      read: async () => {
        const controller = new AbortController()
        snapshotRequest = controller
        const timeout = window.setTimeout(() => controller.abort(), 15000)
        try {
          const result = await client.query({
            query: GetRunningLiveQuizDocument,
            variables: { id },
            fetchPolicy: 'no-cache',
            context: {
              queryDeduplication: false,
              fetchOptions: { signal: controller.signal },
            },
          })
          return result.data
        } finally {
          window.clearTimeout(timeout)
          if (snapshotRequest === controller) snapshotRequest = undefined
        }
      },
      apply: (data) =>
        client.writeQuery({
          query: GetRunningLiveQuizDocument,
          variables: { id },
          data,
        }),
      onState: (next) => {
        if (!active) return
        setStatus(
          operationFailed || !getSubscriptionConnection().connected
            ? 'failed'
            : next
        )
      },
    })

    function stopped(error?: unknown) {
      if (!active) return
      operationFailed = true
      if (error && typeof error === 'object' && 'graphQLErrors' in error) {
        // Operation-level GraphQL failures require explicit recovery, rather than a foreground retry loop.
        authorizationFailed = true
      }
      recovery.invalidate()
      setStatus('failed')
      console.warn('[LiveQuiz] subscription ended')
    }

    function startSubscriptions() {
      operationGeneration++
      const generation = operationGeneration
      subscriptions.forEach((subscription) => {
        subscription.unsubscribe()
      })
      operationFailed = false
      const isCurrent = () => active && generation === operationGeneration
      function subscribe<TData, TVariables extends OperationVariables>(
        document: TypedDocumentNode<TData, TVariables>,
        variables: TVariables,
        update: (
          previous: GetRunningLiveQuizQuery,
          data: TData
        ) => GetRunningLiveQuizQuery
      ) {
        return client
          .subscribe({ query: document, variables, fetchPolicy: 'no-cache' })
          .subscribe({
            next: ({ data }) => {
              if (!isCurrent() || !data) return
              recovery.invalidate()
              client.cache.updateQuery<GetRunningLiveQuizQuery>(
                { query: GetRunningLiveQuizDocument, variables: { id } },
                (prev) => (prev?.studentLiveQuiz ? update(prev, data) : prev)
              )
            },
            error: (error) => {
              if (isCurrent()) stopped(error)
            },
            complete: () => {
              if (isCurrent()) stopped()
            },
          })
      }
      subscriptions = [
        subscribe(RunningLiveQuizUpdatedDocument, { id }, (prev, data) => ({
          ...prev,
          studentLiveQuiz: {
            ...prev.studentLiveQuiz!,
            ...data.runningLiveQuizUpdated,
          },
        })),
        subscribe(
          LiveQuizSettingsChangedDocument,
          { quizId: id },
          (prev, data) =>
            data.liveQuizSettingsChanged
              ? {
                  ...prev,
                  studentLiveQuiz: {
                    ...prev.studentLiveQuiz!,
                    isLiveQAEnabled:
                      data.liveQuizSettingsChanged.isLiveQAEnabled,
                    isConfusionFeedbackEnabled:
                      data.liveQuizSettingsChanged.isConfusionFeedbackEnabled,
                  },
                }
              : prev
        ),
      ]
    }

    function recover(manual = false) {
      if (!active || (!manual && authorizationFailed)) return
      if (!navigator.onLine) {
        setStatus('failed')
        return
      }
      if (manual) {
        authorizationFailed = false
        connection.client?.terminate()
      }
      if (operationFailed) startSubscriptions()
      void recovery.refresh()
    }
    reconnect.current = () => recover(true)
    const foreground = () => {
      if (document.visibilityState === 'visible') recover()
    }
    const online = () => recover()
    const unlisten = connection.client
      ? [
          connection.client.on('connected', () => {
            if (active) {
              recovery.invalidate()
              recover()
            }
          }),
          connection.client.on('closed', (event) => {
            if (!active) return
            const code =
              event &&
              typeof event === 'object' &&
              'code' in event &&
              typeof event.code === 'number'
                ? event.code
                : undefined
            if (
              code &&
              [4400, 4401, 4403, 4406, 4409, 4429, 4005].includes(code)
            )
              authorizationFailed = true
            recovery.invalidate()
            setStatus('failed')
          }),
          connection.client.on('connecting', () => {
            if (active && !operationFailed) setStatus('synchronizing')
          }),
        ]
      : []
    startSubscriptions()
    recover()
    window.addEventListener('online', online)
    window.addEventListener('offline', online)
    window.addEventListener('focus', foreground)
    window.addEventListener('pageshow', foreground)
    document.addEventListener('visibilitychange', foreground)
    return () => {
      active = false
      operationGeneration++
      recovery.dispose()
      snapshotRequest?.abort()
      subscriptions.forEach((subscription) => {
        subscription.unsubscribe()
      })
      unlisten.forEach((stop) => {
        stop()
      })
      window.removeEventListener('online', online)
      window.removeEventListener('offline', online)
      window.removeEventListener('focus', foreground)
      window.removeEventListener('pageshow', foreground)
      document.removeEventListener('visibilitychange', foreground)
    }
  }, [id, client])

  if (status === 'ready') return null
  return (
    <div
      role="status"
      data-cy="live-quiz-connection-status"
      data-state={status}
      className="mx-auto my-3 flex max-w-[88rem] flex-wrap items-center justify-between gap-2 rounded border border-amber-300 bg-amber-50 p-3"
    >
      <span>
        {t(
          status === 'synchronizing'
            ? 'pwa.liveQuiz.synchronizing'
            : 'pwa.liveQuiz.connectionLost'
        )}
      </span>
      <Button
        onClick={() => reconnect.current()}
        data={{ cy: 'live-quiz-reconnect' }}
      >
        {t('pwa.liveQuiz.reconnect')}
      </Button>
    </div>
  )
}

export default LiveQuizSubscriber
