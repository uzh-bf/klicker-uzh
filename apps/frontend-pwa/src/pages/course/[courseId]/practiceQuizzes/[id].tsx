/**
 * The shared embed protocol lives in `components/practiceQuiz/embed.ts`.
 * This page only owns the browser wiring and quiz state projection.
 */
import { useQuery } from '@apollo/client'
import {
  GetPracticeQuizDocument,
  PublicationStatus,
  StackFeedbackStatus,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { parseEmbedParam } from '@klicker-uzh/shared-components/src/utils/parseEmbedParam'
import { addApolloState, initializeApollo } from '@lib/apollo'
import getParticipantToken from '@lib/getParticipantToken'
import useParticipantToken from '@lib/useParticipantToken'
import { UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import type { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import nookies from 'nookies'
import { useCallback, useEffect, useState } from 'react'
import Footer from '../../../../components/common/Footer'
import Layout, {
  LAYOUT_SCROLL_CONTAINER_ID,
} from '../../../../components/Layout'
import {
  EMBED_RESIZE_MESSAGE_TYPE,
  EMBED_RESIZE_VERSION,
  type EmbedCapabilities,
  type EmbedQuizNavigationState,
  type EmbedQuizStatePayload,
  type EmbedResizePayload,
  isAllowedQuizAdvanceMessage,
  isEmbedInitMessage,
  isValidEmbedResizePayload,
  mergeEmbedCapabilities,
  QUIZ_STATE_MESSAGE_TYPE,
  QUIZ_STATE_VERSION,
} from '../../../../components/practiceQuiz/embed'
import PracticeQuiz from '../../../../components/practiceQuiz/PracticeQuiz'

type PracticeQuizProgressState = Record<
  string,
  {
    status: StackFeedbackStatus
  }
>

function PracticeQuizPage({
  courseId,
  id,
  participantToken,
  cookiesAvailable,
  embedded,
  focusedEmbedRequested,
}: {
  courseId: string
  id: string
  participantToken?: string
  cookiesAvailable?: boolean
  embedded: boolean
  focusedEmbedRequested: boolean
}) {
  const t = useTranslations()
  const [currentIx, setCurrentIx] = useState(-1)
  const [parentOrigin, setParentOrigin] = useState<string | null>(null)
  const [embedCapabilities, setEmbedCapabilities] = useState<EmbedCapabilities>(
    {}
  )
  const [resizeHeightValid, setResizeHeightValid] = useState(false)
  const [hostAdvanceRequest, setHostAdvanceRequest] = useState(0)
  const [hostNavigationState, setHostNavigationState] =
    useState<EmbedQuizNavigationState>({
      phase: 'overview',
      canAdvance: false,
    })
  const [isCompleted, setIsCompleted] = useState(false)
  const [completionLoaded, setCompletionLoaded] = useState(false)

  const hostNavigationRequested =
    focusedEmbedRequested || embedCapabilities.hostNavigation === true
  const hostNavigationActive =
    embedded &&
    embedCapabilities.hostNavigation === true &&
    parentOrigin !== null

  const handleHostNavigationStateChange = useCallback(
    (nextState: EmbedQuizNavigationState) => setHostNavigationState(nextState),
    []
  )

  const embeddedAutoResize =
    embedded &&
    embedCapabilities.resize === true &&
    typeof window !== 'undefined' &&
    'ResizeObserver' in window
  const autoResize = embeddedAutoResize && resizeHeightValid

  useParticipantToken({
    participantToken,
    cookiesAvailable,
  })

  const { loading, error, data } = useQuery(GetPracticeQuizDocument, {
    variables: { id },
  })

  const totalSteps = data?.practiceQuiz?.stacks?.length ?? 0

  useEffect(() => {
    if (!embedded) return

    function handleMessage(event: MessageEvent) {
      if (event.source !== window.parent) return

      if (isEmbedInitMessage(event.data)) {
        if (event.origin === 'null') return

        setEmbedCapabilities((currentCapabilities) =>
          mergeEmbedCapabilities(
            currentCapabilities,
            event.data.capabilities ?? {}
          )
        )
        setParentOrigin((currentOrigin) =>
          currentOrigin === event.origin ? currentOrigin : event.origin
        )
        return
      }

      if (
        !hostNavigationActive ||
        event.origin !== parentOrigin ||
        !isAllowedQuizAdvanceMessage(event.data, hostNavigationState) ||
        isCompleted ||
        currentIx < 0
      ) {
        return
      }

      setHostAdvanceRequest((request) => request + 1)
    }

    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [
    currentIx,
    embedded,
    hostNavigationActive,
    hostNavigationState,
    isCompleted,
    parentOrigin,
  ])

  useEffect(() => {
    if (!autoResize) return

    const previousHtmlOverflow = document.documentElement.style.overflow
    const previousBodyOverflow = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow
      document.body.style.overflow = previousBodyOverflow
    }
  }, [autoResize])

  useEffect(() => {
    if (!embeddedAutoResize || !parentOrigin) return

    const container = document.getElementById(LAYOUT_SCROLL_CONTAINER_ID)
    if (!container) return

    let animationFrame: number | null = null

    const postHeight = () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame)
      }

      animationFrame = window.requestAnimationFrame(() => {
        const payload: EmbedResizePayload = {
          version: EMBED_RESIZE_VERSION,
          height: Math.ceil(
            Math.max(
              container.getBoundingClientRect().height,
              container.scrollHeight
            )
          ),
        }

        if (!isValidEmbedResizePayload(payload)) {
          setResizeHeightValid(false)
          return
        }

        setResizeHeightValid(true)

        window.parent.postMessage(
          {
            type: EMBED_RESIZE_MESSAGE_TYPE,
            payload,
          },
          parentOrigin
        )
      })
    }

    const resizeObserver = new ResizeObserver(postHeight)
    resizeObserver.observe(container)
    postHeight()

    return () => {
      resizeObserver.disconnect()
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame)
      }
    }
  }, [embeddedAutoResize, parentOrigin])

  useEffect(() => {
    if (!embedded || !data?.practiceQuiz) return

    const stackIds = data.practiceQuiz.stacks?.map((stack) => stack.id) ?? []
    setIsCompleted(readStoredCompletion(id, stackIds))
    setCompletionLoaded(true)
  }, [embedded, id, data?.practiceQuiz])

  useEffect(() => {
    if (
      !hostNavigationRequested ||
      !completionLoaded ||
      isCompleted ||
      currentIx >= 0 ||
      totalSteps === 0
    ) {
      return
    }

    setHostNavigationState({ phase: 'answering', canAdvance: false })
    setCurrentIx(0)
  }, [
    completionLoaded,
    currentIx,
    hostNavigationRequested,
    isCompleted,
    totalSteps,
  ])

  useEffect(() => {
    if (currentIx >= 0) {
      setIsCompleted(false)
    }
  }, [currentIx])

  useEffect(() => {
    if (!embedded || !parentOrigin || loading || !data?.practiceQuiz) return

    const payload = buildQuizStatePayload({
      currentIx,
      isCompleted,
      totalSteps,
      hostNavigation: hostNavigationActive,
      hostNavigationState,
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
    hostNavigationActive,
    hostNavigationState,
  ])

  if (loading)
    return (
      <Layout embedded={embedded} embeddedAutoResize={autoResize}>
        <Loader />
      </Layout>
    )

  if (!data?.practiceQuiz) {
    return (
      <Layout embedded={embedded} embeddedAutoResize={autoResize}>
        <UserNotification
          type="error"
          message={t('pwa.practiceQuiz.notFound')}
        />
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout embedded={embedded} embeddedAutoResize={autoResize}>
        {t('shared.generic.systemError')}
      </Layout>
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
        embeddedAutoResize={autoResize}
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
    setHostNavigationState({ phase: 'answering', canAdvance: false })
    setCurrentIx((ix) => ix + 1)
  }

  const handleSetCurrentIx = (ix: number) => {
    if (ix >= 0) {
      setHostNavigationState({ phase: 'answering', canAdvance: false })
    }
    setCurrentIx(ix)
  }

  return (
    <Layout
      embedded={embedded}
      embeddedAutoResize={autoResize}
      displayName={data.practiceQuiz.displayName}
      course={data.practiceQuiz.course ?? undefined}
    >
      {focusedEmbedRequested && isCompleted ? (
        <div
          role="status"
          className="rounded-lg bg-slate-50 px-4 py-5 text-center text-sm font-medium text-slate-700"
          data-cy="focused-embed-completed"
        >
          {t.rich('pwa.practiceQuiz.solvedPracticeQuiz', {
            name: data.practiceQuiz.displayName,
            it: (text) => <span className="italic">{text}</span>,
          })}
        </div>
      ) : (
        <PracticeQuiz
          showResetLocalStorage
          embedded={embedded}
          focusedPresentation={focusedEmbedRequested}
          hostNavigation={hostNavigationActive}
          hostAdvanceRequest={hostAdvanceRequest}
          onHostNavigationStateChange={handleHostNavigationStateChange}
          quiz={{
            ...data.practiceQuiz,
            course: data.practiceQuiz.course!,
          }}
          currentIx={currentIx}
          setCurrentIx={handleSetCurrentIx}
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
      )}
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
    const focusedEmbedRequested = embedded && ctx.query.embedMode === 'focused'

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
          focusedEmbedRequested,
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
        focusedEmbedRequested,
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
  hostNavigation,
  hostNavigationState,
}: {
  currentIx: number
  isCompleted: boolean
  totalSteps: number
  hostNavigation: boolean
  hostNavigationState: EmbedQuizNavigationState
}): EmbedQuizStatePayload {
  if (currentIx >= 0) {
    const payload: EmbedQuizStatePayload = {
      version: QUIZ_STATE_VERSION,
      status: 'in-progress',
      currentStep: currentIx + 1,
      totalSteps,
    }

    return hostNavigation ? { ...payload, ...hostNavigationState } : payload
  }

  if (isCompleted) {
    const payload: EmbedQuizStatePayload = {
      version: QUIZ_STATE_VERSION,
      status: 'completed',
      currentStep: totalSteps,
      totalSteps,
    }

    return hostNavigation
      ? { ...payload, phase: 'completed', canAdvance: false }
      : payload
  }

  const payload: EmbedQuizStatePayload = {
    version: QUIZ_STATE_VERSION,
    status: 'overview',
    currentStep: 0,
    totalSteps,
  }

  return hostNavigation
    ? { ...payload, phase: 'overview', canAdvance: false }
    : payload
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
