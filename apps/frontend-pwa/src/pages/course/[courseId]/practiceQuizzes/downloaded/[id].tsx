import { useQuery } from '@apollo/client'
import { SelfDocument, UserRole } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { addApolloState, initializeApollo } from '@lib/apollo'
import getParticipantToken from '@lib/getParticipantToken'
import useParticipantToken from '@lib/useParticipantToken'
import { UserNotification } from '@uzh-bf/design-system'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import nookies from 'nookies'
import { useCallback, useEffect, useState } from 'react'
import Layout, {
  LAYOUT_SCROLL_CONTAINER_ID,
} from '../../../../../components/Layout'
import type { PracticeStackSubmitHandler } from '../../../../../components/practiceQuiz/ElementStack'
import PracticeQuiz from '../../../../../components/practiceQuiz/PracticeQuiz'
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
  const [isCompleted, setIsCompleted] = useState(false)

  useParticipantToken({
    participantToken,
    cookiesAvailable,
  })

  const { data: selfData, loading: loadingSelf } = useQuery(SelfDocument, {
    fetchPolicy: 'cache-first',
    skip: !!rememberedParticipantId,
  })

  const onlineParticipantId =
    selfData?.self?.role === UserRole.Participant ? selfData.self.id : null
  const participantId = onlineParticipantId ?? rememberedParticipantId

  useEffect(() => {
    if (!onlineParticipantId) return

    rememberOfflinePracticeParticipant(onlineParticipantId)
  }, [onlineParticipantId])

  useEffect(() => {
    let cancelled = false

    if (!participantId) {
      if (!loadingSelf) {
        setLoadingSnapshot(false)
      }
      return
    }

    setLoadingSnapshot(true)
    setLoadFailed(false)

    Promise.all([
      loadDownloadedPracticeQuiz(participantId, id),
      listDownloadedPracticeQuizzes(participantId),
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
  }, [id, loadingSelf, participantId])

  const handleNextQuestion = () => {
    document.getElementById(LAYOUT_SCROLL_CONTAINER_ID)?.scrollTo({ top: 0 })
    setCurrentIx((ix) => ix + 1)
  }

  const handleSubmitStack = useCallback<PracticeStackSubmitHandler>(
    async ({ stack, responses, stackAnswerTime }) => {
      if (!participantId || !snapshot) return null

      setSubmitFailed(false)

      try {
        const feedback = await submitPracticeStackOffline({
          participantId,
          snapshot,
          stack,
          responses,
          stackAnswerTime,
        })
        const entries = await listDownloadedPracticeQuizzes(participantId)

        rememberOfflinePracticeParticipant(participantId)
        setDownloadedEntry(entries.find((entry) => entry.quizId === id) ?? null)
        setSubmitFailed(false)

        return feedback
      } catch (error) {
        console.error('Failed to save offline practice attempt', error)
        setSubmitFailed(true)
        return null
      }
    },
    [id, participantId, snapshot]
  )

  if (loadingSnapshot || (loadingSelf && !rememberedParticipantId)) {
    return (
      <Layout>
        <Loader />
      </Layout>
    )
  }

  if (loadFailed || !participantId || !snapshot) {
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
          <UserNotification
            type="info"
            message={t('pwa.practiceQuiz.pendingOfflineAttempts', {
              count: downloadedEntry.pendingAttemptCount,
            })}
            className={{ root: 'text-base' }}
          />
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
      </div>
      <PracticeQuiz
        showResetLocalStorage
        offlineMode
        storageId={getDownloadedPracticeLocalStorageId(
          participantId,
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
