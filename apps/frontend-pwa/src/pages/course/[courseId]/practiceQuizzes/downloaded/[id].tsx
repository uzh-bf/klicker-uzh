import { useQuery } from '@apollo/client'
import { faRotate } from '@fortawesome/free-solid-svg-icons'
import { SelfDocument, UserRole } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { addApolloState, initializeApollo } from '@lib/apollo'
import getParticipantToken from '@lib/getParticipantToken'
import useParticipantToken from '@lib/useParticipantToken'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import nookies from 'nookies'
import { useCallback, useEffect, useState } from 'react'
import Layout, {
  LAYOUT_SCROLL_CONTAINER_ID,
} from '../../../../../components/Layout'
import type { PracticeStackSubmitHandler } from '../../../../../components/practiceQuiz/ElementStack'
import PracticeQuiz from '../../../../../components/practiceQuiz/PracticeQuiz'
import { useOfflinePracticeSync } from '../../../../../lib/hooks/useOfflinePracticeSync'
import {
  getDownloadedPracticeLocalStorageId,
  listDownloadedPracticeQuizzes,
  loadDownloadedPracticeQuiz,
  readRememberedOfflinePracticeParticipant,
  rememberOfflinePracticeParticipant,
  type OfflinePracticeIndexEntry,
  type OfflinePracticeSnapshot,
} from '../../../../../lib/offlinePracticeStorage'
import { submitPracticeStackOffline } from '../../../../../lib/practiceStackResponse'

function DownloadedPracticeQuizPage({
  courseId,
  id,
  participantToken,
  cookiesAvailable,
}: {
  courseId: string
  id: string
  participantToken?: string
  cookiesAvailable?: boolean
}) {
  const t = useTranslations()
  const [currentIx, setCurrentIx] = useState(-1)
  const [snapshot, setSnapshot] = useState<OfflinePracticeSnapshot | null>(null)
  const [downloadedEntry, setDownloadedEntry] =
    useState<OfflinePracticeIndexEntry | null>(null)
  const [rememberedParticipantId] = useState(() =>
    readRememberedOfflinePracticeParticipant()
  )
  const [loadingSnapshot, setLoadingSnapshot] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [submitFailed, setSubmitFailed] = useState(false)
  const [syncNotice, setSyncNotice] = useState<{
    type: 'success' | 'warning' | 'error'
    message: string
  } | null>(null)
  const [isCompleted, setIsCompleted] = useState(false)

  useParticipantToken({
    participantToken,
    cookiesAvailable,
  })

  const { data: selfData, loading: loadingSelf } = useQuery(SelfDocument, {
    fetchPolicy: 'network-only',
  })

  const onlineParticipantId =
    selfData?.self?.role === UserRole.Participant ? selfData.self.id : null
  const storageParticipantId = onlineParticipantId ?? rememberedParticipantId
  const refreshDownloadedEntry = useCallback(async () => {
    if (!storageParticipantId) {
      setDownloadedEntry(null)
      return
    }

    try {
      const entries = await listDownloadedPracticeQuizzes(storageParticipantId)
      setDownloadedEntry(entries.find((entry) => entry.quizId === id) ?? null)
    } catch (error) {
      console.warn('Failed to read downloaded practice quizzes', error)
    }
  }, [id, storageParticipantId])
  const { syncNow, syncing } = useOfflinePracticeSync({
    participantId: onlineParticipantId,
    onSynced: refreshDownloadedEntry,
  })

  useEffect(() => {
    if (!onlineParticipantId) return

    rememberOfflinePracticeParticipant(onlineParticipantId)
  }, [onlineParticipantId])

  useEffect(() => {
    let cancelled = false

    if (!storageParticipantId) {
      if (!loadingSelf) {
        setLoadingSnapshot(false)
      }
      return
    }

    setLoadingSnapshot(true)
    setLoadFailed(false)

    Promise.all([
      loadDownloadedPracticeQuiz(storageParticipantId, id),
      listDownloadedPracticeQuizzes(storageParticipantId),
    ])
      .then(([loadedSnapshot, entries]) => {
        if (cancelled) return

        setSnapshot(loadedSnapshot)
        setDownloadedEntry(entries.find((entry) => entry.quizId === id) ?? null)
      })
      .catch((error) => {
        if (cancelled) return

        console.error('Failed to load downloaded practice quiz', error)
        setLoadFailed(true)
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingSnapshot(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [id, loadingSelf, storageParticipantId])

  const handleNextQuestion = () => {
    document.getElementById(LAYOUT_SCROLL_CONTAINER_ID)?.scrollTo({ top: 0 })
    setCurrentIx((ix) => ix + 1)
  }

  const handleSubmitStack = useCallback<PracticeStackSubmitHandler>(
    async ({ stack, responses, stackAnswerTime }) => {
      if (!storageParticipantId || !snapshot) return null

      setSubmitFailed(false)

      try {
        const feedback = await submitPracticeStackOffline({
          participantId: storageParticipantId,
          snapshot,
          stack,
          responses,
          stackAnswerTime,
        })
        const entries =
          await listDownloadedPracticeQuizzes(storageParticipantId)

        if (onlineParticipantId) {
          rememberOfflinePracticeParticipant(onlineParticipantId)
        }
        setDownloadedEntry(entries.find((entry) => entry.quizId === id) ?? null)
        setSubmitFailed(false)
        void syncNow()

        return feedback
      } catch (error) {
        console.error('Failed to save offline practice attempt', error)
        setSubmitFailed(true)
        return null
      }
    },
    [id, onlineParticipantId, snapshot, storageParticipantId, syncNow]
  )

  const handleSyncOfflineAttempts = async () => {
    setSyncNotice(null)

    const result = await syncNow()
    await refreshDownloadedEntry()

    if (!result) {
      setSyncNotice({
        type: 'error',
        message: t('pwa.practiceQuiz.offlineAttemptSyncFailed'),
      })
      return
    }

    if (result.attemptedCount === 0) {
      return
    }

    const hasSyncConflicts =
      result.rejectedCount > 0 || result.remainingPendingAttemptCount > 0

    setSyncNotice({
      type: hasSyncConflicts ? 'warning' : 'success',
      message: hasSyncConflicts
        ? t('pwa.practiceQuiz.offlineAttemptSyncConflicts')
        : t('pwa.practiceQuiz.offlineAttemptsSynced'),
    })
  }

  if (loadingSnapshot || (loadingSelf && !storageParticipantId)) {
    return (
      <Layout>
        <Loader />
      </Layout>
    )
  }

  if (loadFailed || !storageParticipantId || !snapshot) {
    return (
      <Layout>
        <UserNotification
          type="warning"
          message={t('pwa.practiceQuiz.downloadedNotFound')}
          className={{ root: 'text-base' }}
        />
      </Layout>
    )
  }

  return (
    <Layout
      displayName={snapshot.quiz.displayName}
      course={snapshot.quiz.course ?? undefined}
    >
      <div className="mb-4 flex w-full flex-col gap-2 md:mx-auto md:max-w-6xl md:px-8">
        {downloadedEntry && downloadedEntry.pendingAttemptCount > 0 && (
          <>
            <UserNotification
              type="info"
              message={t('pwa.practiceQuiz.pendingOfflineAttempts', {
                count: downloadedEntry.pendingAttemptCount,
              })}
              className={{ root: 'text-base' }}
            />
            <Button
              onClick={handleSyncOfflineAttempts}
              disabled={syncing}
              className={{ root: 'justify-start gap-2 text-base' }}
              data={{ cy: 'sync-offline-practice-attempts' }}
            >
              <Button.Icon icon={faRotate} loading={syncing} />
              <Button.Label>
                {t('pwa.practiceQuiz.syncOfflineAttempts')}
              </Button.Label>
            </Button>
          </>
        )}
        {isCompleted && (
          <UserNotification
            type="success"
            message={t('pwa.practiceQuiz.offlineAttemptSaved')}
            className={{ root: 'text-base' }}
          />
        )}
        {submitFailed && (
          <UserNotification
            type="error"
            message={t('pwa.practiceQuiz.offlineAttemptSaveFailed')}
            className={{ root: 'text-base' }}
          />
        )}
        {syncNotice && (
          <UserNotification
            type={syncNotice.type}
            message={syncNotice.message}
            className={{ root: 'text-base' }}
          />
        )}
      </div>
      <PracticeQuiz
        showResetLocalStorage
        offlineMode
        storageId={getDownloadedPracticeLocalStorageId(
          storageParticipantId,
          snapshot.quiz.id
        )}
        quiz={{
          ...snapshot.quiz,
          course: snapshot.quiz.course ?? { id: courseId },
        }}
        currentIx={currentIx}
        setCurrentIx={setCurrentIx}
        handleNextElement={handleNextQuestion}
        onAllStacksCompletion={() => {
          setIsCompleted(true)
          setCurrentIx(-1)
        }}
        submitStack={handleSubmitStack}
      />
    </Layout>
  )
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  try {
    if (
      typeof ctx.params?.courseId !== 'string' ||
      typeof ctx.params?.id !== 'string'
    ) {
      return {
        redirect: {
          destination: `${ctx.locale ? `/${ctx.locale}` : ''}/404`,
          statusCode: 302,
        },
      }
    }

    const apolloClient = initializeApollo()
    const { participantToken, cookiesAvailable } = await getParticipantToken({
      apolloClient,
      courseId: ctx.params.courseId,
      ctx,
    })

    return addApolloState(apolloClient, {
      props: {
        participantToken,
        cookiesAvailable,
        id: ctx.params.id,
        courseId: ctx.params.courseId,
        messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
          .default,
      },
    })
  } catch (error) {
    console.error(
      'Error in getServerSideProps on downloaded practice quiz:',
      error
    )

    try {
      nookies.destroy(ctx, 'lti-token', {
        domain: process.env.COOKIE_DOMAIN,
        path: '/',
      })
    } catch (nookiesError) {
      console.error(nookiesError)
    }

    return {
      redirect: {
        destination: `${ctx.locale ? `/${ctx.locale}` : ''}/serverError?redirectTo=${encodeURIComponent(`/${ctx.locale}/course/${ctx.params?.courseId}/practiceQuizzes/downloaded/${ctx.params?.id}`)}`,
        permanent: false,
      },
    }
  }
}

export default DownloadedPracticeQuizPage
