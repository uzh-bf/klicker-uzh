/**
 * Embedded quiz postMessage protocol (for parent/embedding apps):
 *
 * When loaded with ?embed=true, the parent app must first register itself:
 *   iframe.contentWindow?.postMessage({ type: 'klicker:embed-init' }, iframeOrigin)
 *
 * After receiving that init message, this page posts state updates to the
 * registered parent origin:
 *   {
 *     type: 'klicker:quiz-state',
 *     payload: { version, status, currentStep, totalSteps },
 *   }
 *
 * status values:
 *   'overview'    - quiz not yet started
 *   'in-progress' - student is answering questions
 *   'completed'   - all stacks answered, quiz finished
 *
 * Example listener in the embedding app:
 *
 *   function useKlickerQuizState(iframe: HTMLIFrameElement, iframeOrigin: string) {
 *     const [quizState, setQuizState] = useState({
 *       version: 1,
 *       status: 'overview',
 *       currentStep: 0,
 *       totalSteps: 0,
 *     })
 *     useEffect(() => {
 *       const handler = (e: MessageEvent) => {
 *         if (e.origin !== iframeOrigin) return
 *         if (e.data?.type === 'klicker:quiz-state') {
 *           setQuizState(e.data.payload)
 *         }
 *       }
 *
 *       window.addEventListener('message', handler)
 *
 *       const frame = iframe
 *       if (frame) {
 *         const registerParent = () => {
 *           frame.contentWindow?.postMessage(
 *             { type: 'klicker:embed-init' },
 *             iframeOrigin
 *           )
 *         }
 *
 *         frame.addEventListener('load', registerParent)
 *         registerParent()
 *
 *         return () => {
 *           window.removeEventListener('message', handler)
 *           frame.removeEventListener('load', registerParent)
 *         }
 *       }
 *
 *       return () => window.removeEventListener('message', handler)
 *     }, [iframeOrigin])
 *     return quizState
 *   }
 *
 *   // Usage: hide e-learning "Weiter" until quiz is completed
 *   const quizState = useKlickerQuizState(iframeElement, 'https://pwa.klicker.uzh.ch')
 *   {quizState.status === 'completed' && <button>Weiter</button>}
 */
import { useLazyQuery, useQuery } from '@apollo/client'
import {
  faDownload,
  faFolderOpen,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import {
  GetPracticeQuizDocument,
  GetPracticeQuizDownloadSnapshotDocument,
  PublicationStatus,
  SelfDocument,
  StackFeedbackStatus,
  UserRole,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { parseEmbedParam } from '@klicker-uzh/shared-components/src/utils/parseEmbedParam'
import { addApolloState, initializeApollo } from '@lib/apollo'
import getParticipantToken from '@lib/getParticipantToken'
import useParticipantToken from '@lib/useParticipantToken'
import { Button, UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import nookies from 'nookies'
import { useEffect, useState } from 'react'
import Layout, {
  LAYOUT_SCROLL_CONTAINER_ID,
} from '../../../../components/Layout'
import Footer from '../../../../components/common/Footer'
import LinkButton from '../../../../components/common/LinkButton'
import PracticeQuiz from '../../../../components/practiceQuiz/PracticeQuiz'
import {
  deleteDownloadedPracticeQuiz,
  listDownloadedPracticeQuizzes,
  rememberOfflinePracticeParticipant,
  saveDownloadedPracticeQuiz,
  type OfflinePracticeIndexEntry,
} from '../../../../lib/offlinePracticeStorage'

const EMBED_INIT_MESSAGE_TYPE = 'klicker:embed-init'
const QUIZ_STATE_MESSAGE_TYPE = 'klicker:quiz-state'
const QUIZ_STATE_VERSION = 1

type EmbedQuizStatus = 'overview' | 'in-progress' | 'completed'

type EmbedQuizStatePayload = {
  version: typeof QUIZ_STATE_VERSION
  status: EmbedQuizStatus
  currentStep: number
  totalSteps: number
}

type PracticeQuizProgressState = Record<
  string,
  {
    status: StackFeedbackStatus
    score?: number | null
  }
>

function PracticeQuizPage({
  courseId,
  id,
  participantToken,
  cookiesAvailable,
  embedded,
}: {
  courseId: string
  id: string
  participantToken?: string
  cookiesAvailable?: boolean
  embedded: boolean
}) {
  const t = useTranslations()
  const [currentIx, setCurrentIx] = useState(-1)
  const [parentOrigin, setParentOrigin] = useState<string | null>(null)
  const [isCompleted, setIsCompleted] = useState(false)
  const [downloadedEntry, setDownloadedEntry] =
    useState<OfflinePracticeIndexEntry | null>(null)
  const [downloadNotice, setDownloadNotice] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [deletingDownload, setDeletingDownload] = useState(false)

  useParticipantToken({
    participantToken,
    cookiesAvailable,
  })

  const { loading, error, data } = useQuery(GetPracticeQuizDocument, {
    variables: { id },
  })
  const { data: selfData } = useQuery(SelfDocument, {
    skip: embedded,
  })
  const [fetchDownloadSnapshot, { loading: downloadingSnapshot }] =
    useLazyQuery(GetPracticeQuizDownloadSnapshotDocument, {
      fetchPolicy: 'network-only',
    })

  const totalSteps = data?.practiceQuiz?.stacks?.length ?? 0
  const participant =
    selfData?.self?.role === UserRole.Participant ? selfData.self : null

  useEffect(() => {
    if (!embedded) return

    function handleMessage(event: MessageEvent) {
      if (event.source !== window.parent) return
      if (!isEmbedInitMessage(event.data) || event.origin === 'null') return

      setParentOrigin((currentOrigin) =>
        currentOrigin === event.origin ? currentOrigin : event.origin
      )
    }

    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [embedded])

  useEffect(() => {
    if (!embedded || !data?.practiceQuiz) return

    const stackIds = data.practiceQuiz.stacks?.map((stack) => stack.id) ?? []
    setIsCompleted(readStoredCompletion(id, stackIds))
  }, [embedded, id, data?.practiceQuiz])

  useEffect(() => {
    if (currentIx >= 0) {
      setIsCompleted(false)
    }
  }, [currentIx])

  useEffect(() => {
    let cancelled = false

    if (!participant?.id || embedded) {
      setDownloadedEntry(null)
      return
    }

    listDownloadedPracticeQuizzes(participant.id)
      .then((entries) => {
        if (cancelled) return

        setDownloadedEntry(entries.find((entry) => entry.quizId === id) ?? null)
      })
      .catch((error) => {
        console.warn('Failed to read downloaded practice quizzes', error)
      })

    return () => {
      cancelled = true
    }
  }, [embedded, id, participant?.id])

  useEffect(() => {
    if (!embedded || !parentOrigin || loading || !data?.practiceQuiz) return

    const payload = buildQuizStatePayload({
      currentIx,
      isCompleted,
      totalSteps,
    })

    window.parent.postMessage(
      {
        type: QUIZ_STATE_MESSAGE_TYPE,
        payload,
      },
      parentOrigin
    )
  }, [
    embedded,
    parentOrigin,
    loading,
    data?.practiceQuiz,
    currentIx,
    isCompleted,
    totalSteps,
  ])

  if (loading)
    return (
      <Layout embedded={embedded}>
        <Loader />
      </Layout>
    )

  if (!data?.practiceQuiz) {
    return (
      <Layout embedded={embedded}>
        <UserNotification
          type="error"
          message={t('pwa.practiceQuiz.notFound')}
        />
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout embedded={embedded}>{t('shared.generic.systemError')}</Layout>
    )
  }

  // show notification with activity start date
  if (
    data.practiceQuiz.status === PublicationStatus.Scheduled &&
    !data.practiceQuiz.isOwner
  ) {
    return (
      <Layout
        embedded={embedded}
        displayName={data.practiceQuiz.displayName}
        course={data.practiceQuiz.course ?? undefined}
      >
        <UserNotification
          type="warning"
          message={t('pwa.practiceQuiz.scheduledAvailableFrom', {
            name: data.practiceQuiz.displayName,
            date: dayjs(data.practiceQuiz.availableFrom).format(
              'DD.MM.YYYY HH:mm'
            ),
          })}
        />
      </Layout>
    )
  }

  const handleNextQuestion = () => {
    document.getElementById(LAYOUT_SCROLL_CONTAINER_ID)?.scrollTo({ top: 0 })
    setCurrentIx((ix) => ix + 1)
  }

  const handleDownloadPracticeQuiz = async () => {
    if (!participant?.id) return

    setDownloadNotice(null)

    try {
      const result = await fetchDownloadSnapshot({ variables: { id } })
      const snapshot = result.data?.practiceQuizDownloadSnapshot

      if (!snapshot) {
        setDownloadNotice({
          type: 'error',
          message: t('pwa.practiceQuiz.downloadFailed'),
        })
        return
      }

      const entry = await saveDownloadedPracticeQuiz(participant.id, snapshot)
      rememberOfflinePracticeParticipant(participant.id)
      setDownloadedEntry(entry)
      setDownloadNotice({
        type: 'success',
        message: t('pwa.practiceQuiz.downloadReady'),
      })
    } catch (error) {
      console.error('Failed to download practice quiz', error)
      setDownloadNotice({
        type: 'error',
        message: t('pwa.practiceQuiz.downloadFailed'),
      })
    }
  }

  const handleDeleteDownloadedPracticeQuiz = async () => {
    if (!participant?.id) return

    setDeletingDownload(true)
    setDownloadNotice(null)

    try {
      await deleteDownloadedPracticeQuiz(participant.id, id)
      setDownloadedEntry(null)
    } catch (error) {
      console.error('Failed to delete downloaded practice quiz', error)
      setDownloadNotice({
        type: 'error',
        message: t('pwa.practiceQuiz.deleteDownloadFailed'),
      })
    } finally {
      setDeletingDownload(false)
    }
  }

  const showDownloadControls =
    !embedded && !!participant?.id && !data.practiceQuiz.isOwner

  return (
    <Layout
      embedded={embedded}
      displayName={data.practiceQuiz.displayName}
      course={data.practiceQuiz.course ?? undefined}
    >
      {showDownloadControls && (
        <div className="mb-4 flex w-full flex-col gap-2 md:mx-auto md:max-w-6xl md:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              onClick={handleDownloadPracticeQuiz}
              disabled={downloadingSnapshot}
              className={{ root: 'justify-start gap-2 text-base' }}
              data={{ cy: 'download-practice-quiz' }}
            >
              <Button.Icon icon={faDownload} loading={downloadingSnapshot} />
              <Button.Label>
                {downloadedEntry
                  ? t('pwa.practiceQuiz.updateDownload')
                  : t('pwa.practiceQuiz.downloadForOffline')}
              </Button.Label>
            </Button>
            {downloadedEntry && (
              <LinkButton
                href={`/course/${courseId}/practiceQuizzes/downloaded/${id}`}
                icon={faFolderOpen}
                className={{ root: 'gap-2 text-base', icon: 'h-5 w-5' }}
                data={{ cy: 'open-downloaded-practice-quiz' }}
              >
                {t('pwa.practiceQuiz.openDownloaded')}
              </LinkButton>
            )}
            {downloadedEntry && (
              <Button
                onClick={handleDeleteDownloadedPracticeQuiz}
                disabled={deletingDownload}
                className={{ root: 'justify-start gap-2 text-base' }}
                data={{ cy: 'delete-downloaded-practice-quiz' }}
              >
                <Button.Icon icon={faTrash} loading={deletingDownload} />
                <Button.Label>
                  {t('pwa.practiceQuiz.deleteDownload')}
                </Button.Label>
              </Button>
            )}
          </div>
          {downloadedEntry && downloadedEntry.pendingAttemptCount > 0 && (
            <UserNotification
              type="info"
              message={t('pwa.practiceQuiz.pendingOfflineAttempts', {
                count: downloadedEntry.pendingAttemptCount,
              })}
              className={{ root: 'text-base' }}
            />
          )}
          {downloadNotice && (
            <UserNotification
              type={downloadNotice.type}
              message={downloadNotice.message}
              className={{ root: 'text-base' }}
            />
          )}
        </div>
      )}
      <PracticeQuiz
        showResetLocalStorage
        embedded={embedded}
        quiz={{
          ...data.practiceQuiz,
          course: data.practiceQuiz.course!,
        }}
        currentIx={currentIx}
        setCurrentIx={setCurrentIx}
        handleNextElement={handleNextQuestion}
        onAllStacksCompletion={
          embedded
            ? () => {
                setIsCompleted(true)
                setCurrentIx(-1)
              }
            : undefined
        }
        previewOnly={data.practiceQuiz.isOwner ?? undefined}
      />
      {!embedded && (
        <Footer
          browserLink={`${process.env.NEXT_PUBLIC_PWA_URL}/course/${courseId}/practiceQuizzes/${id}`}
        />
      )}
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

    const embedded = parseEmbedParam(ctx.query.embed)

    const { participantToken, cookiesAvailable } = await getParticipantToken({
      apolloClient,
      courseId: ctx.params.courseId,
      ctx,
    })

    if (participantToken) {
      return {
        props: {
          participantToken,
          cookiesAvailable,
          id: ctx.params.id,
          courseId: ctx.params.courseId,
          embedded,
          messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
            .default,
        },
      }
    }

    return addApolloState(apolloClient, {
      props: {
        id: ctx.params.id,
        courseId: ctx.params.courseId,
        embedded,
        messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
          .default,
      },
    })
  } catch (error) {
    console.error('Error in getServerSideProps on practice quiz:', error)

    // remove the lti-token, if it is defined
    try {
      nookies.destroy(ctx, 'lti-token', {
        domain: process.env.COOKIE_DOMAIN,
        path: '/',
      })
    } catch (nookiesError) {
      console.error(nookiesError)
    }

    // redirect to lti error page with redirect back to this page
    return {
      redirect: {
        destination: `${ctx.locale ? `/${ctx.locale}` : ''}/serverError?redirectTo=${encodeURIComponent(`/${ctx.locale}/course/${ctx.params?.courseId}/practiceQuizzes/${ctx.params?.id}`)}`,
        permanent: false,
      },
    }
  }
}

export default PracticeQuizPage

function buildQuizStatePayload({
  currentIx,
  isCompleted,
  totalSteps,
}: {
  currentIx: number
  isCompleted: boolean
  totalSteps: number
}): EmbedQuizStatePayload {
  if (currentIx >= 0) {
    return {
      version: QUIZ_STATE_VERSION,
      status: 'in-progress',
      currentStep: currentIx + 1,
      totalSteps,
    }
  }

  if (isCompleted) {
    return {
      version: QUIZ_STATE_VERSION,
      status: 'completed',
      currentStep: totalSteps,
      totalSteps,
    }
  }

  return {
    version: QUIZ_STATE_VERSION,
    status: 'overview',
    currentStep: 0,
    totalSteps,
  }
}

function isEmbedInitMessage(data: unknown): boolean {
  return isRecord(data) && data.type === EMBED_INIT_MESSAGE_TYPE
}

function readStoredCompletion(
  quizId: string,
  stackIds: Array<string | number>
): boolean {
  if (typeof window === 'undefined' || stackIds.length === 0) {
    return false
  }

  try {
    const rawProgressState = window.localStorage.getItem(`pq-${quizId}`)
    if (!rawProgressState) return false

    const progressState = JSON.parse(
      rawProgressState
    ) as PracticeQuizProgressState

    return stackIds.every((stackId) => {
      const status = progressState?.[String(stackId)]?.status
      return status && status !== StackFeedbackStatus.Unanswered
    })
  } catch (error) {
    console.warn(
      'Failed to read stored practice quiz progress for embed state',
      {
        quizId,
        error,
      }
    )
    return false
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
