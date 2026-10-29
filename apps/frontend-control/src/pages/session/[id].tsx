import { useMutation, useQuery } from '@apollo/client'
import {
  faPersonChalkboard,
  faPlay,
  faStop,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ActivateLiveQuizBlockDocument,
  DeactivateLiveQuizBlockDocument,
  ElementBlockStatus,
  EndLiveQuizDocument,
  GetControlCourseLiveQuizzesDocument,
  GetControlCourseOverviewDocument,
  GetControlLiveQuizEvaluationDocument,
  GetControlLiveQuizFeedbacksDocument,
  GetControlLiveQuizSessionDocument,
  GetControlLiveQuizStatusDocument,
  GetUnassignedControlLiveQuizzesDocument,
  GetUserRunningLiveQuizzesDocument,
  PublicationStatus,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, toast, UserNotification } from '@uzh-bf/design-system'
import type { GetStaticPropsContext } from 'next'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { findLast, sort } from 'remeda'
import ResponsiveSheet from '../../components/common/ResponsiveSheet'
import {
  dangerButtonClass,
  iconButtonClass,
  largeButtonClass,
  outlineButtonClass,
  primaryButtonClass,
  sheetButtonClass,
} from '../../components/common/styles'
import Layout from '../../components/Layout'
import AppBar from '../../components/layout/AppBar'
import EmbeddingModal from '../../components/liveQuizzes/EmbeddingModal'
import BlockProgress from '../../components/session/BlockProgress'
import BlockStatusCard from '../../components/session/BlockStatusCard'
import LeinwandCard from '../../components/session/LeinwandCard'
import LiveEvaluationCard from '../../components/session/LiveEvaluationCard'
import QAPanel from '../../components/session/QAPanel'
import QuizEnded from '../../components/session/QuizEnded'
import SessionTabs, {
  type SessionTab,
} from '../../components/session/SessionTabs'
import StatsPanel from '../../components/session/StatsPanel'

function RunningLiveQuiz() {
  const t = useTranslations()
  const router = useRouter()
  const [endSheetOpen, setEndSheetOpen] = useState(false)
  const [embedOpen, setEmbedOpen] = useState(false)
  const [tab, setTab] = useState<SessionTab>('control')
  // selected question of the evaluated block, shared by evaluation + Leinwand
  const [selectedQuestion, setSelectedQuestion] = useState<{
    blockId: number | null
    index: number
  }>({ blockId: null, index: 0 })
  const [ended, setEnded] = useState<{
    name: string
    numOfBlocks: number
    backHref: string
  } | null>(null)

  const quizId = router.query.id as string

  const { loading, data } = useQuery(GetControlLiveQuizSessionDocument, {
    variables: { id: quizId },
    pollInterval: 1000,
    skip: !quizId || !!ended,
  })

  // the session query only returns running quizzes; when it comes back empty
  // (e.g. after a reload once the quiz was ended), look up whether it ended
  const sessionMissing =
    !!quizId && !ended && !loading && !data?.controlLiveQuiz
  const { data: statusData, error: statusError } = useQuery(
    GetControlLiveQuizStatusDocument,
    {
      variables: { id: quizId },
      skip: !sessionMissing,
    }
  )
  const endedQuiz =
    statusData?.liveQuiz?.status === PublicationStatus.Ended
      ? statusData.liveQuiz
      : null
  const derivedEnded = endedQuiz
    ? {
        name: endedQuiz.name,
        numOfBlocks: endedQuiz.blocks?.length ?? 0,
        backHref: endedQuiz.course
          ? `/course/${endedQuiz.course.id}`
          : '/course/unassigned',
      }
    : null
  // keep the looked-up ended state so the session and Q&A polls stop
  useEffect(() => {
    if (derivedEnded && !ended) setEnded(derivedEnded)
  }, [derivedEnded, ended])

  // polled on both tabs so the Q&A tab can show the pending counter
  const { data: qaData } = useQuery(GetControlLiveQuizFeedbacksDocument, {
    variables: { id: quizId },
    pollInterval: 3000,
    skip: !quizId || !!ended,
  })
  const qa = qaData?.controlLiveQuizFeedbacks
  const pendingQuestions = qa?.isModerationEnabled
    ? (qa.feedbacks ?? []).filter(
        (feedback) => !feedback.isPublished && !feedback.isResolved
      ).length
    : 0

  const refetchQueries = [GetControlLiveQuizSessionDocument]
  const [activateLiveQuizBlock, { loading: activatingBlock }] = useMutation(
    ActivateLiveQuizBlockDocument,
    { refetchQueries }
  )
  const [deactivateLiveQuizBlock, { loading: deactivatingBlock }] = useMutation(
    DeactivateLiveQuizBlockDocument,
    {
      // polling of the evaluation stops once the block is closed, so fetch
      // the final results once to include the last answers
      refetchQueries: [...refetchQueries, GetControlLiveQuizEvaluationDocument],
    }
  )
  const [endLiveQuiz, { loading: endingLiveQuiz }] = useMutation(
    EndLiveQuizDocument,
    {
      // the ended quiz leaves the lists, the overview counts and the banner
      refetchQueries: [
        GetControlCourseLiveQuizzesDocument,
        GetUnassignedControlLiveQuizzesDocument,
        GetControlCourseOverviewDocument,
        GetUserRunningLiveQuizzesDocument,
      ],
    }
  )

  const runAction = async (action: () => Promise<unknown>) => {
    try {
      await action()
    } catch {
      toast({
        type: 'error',
        message: t('control.liveQuiz.actionFailed'),
        options: { duration: 5000 },
      })
    }
  }

  const endedState = ended ?? derivedEnded
  if (endedState) {
    return (
      <Layout
        title={t('control.liveQuiz.ended')}
        header={
          <AppBar title={endedState.name} backHref={endedState.backHref} />
        }
      >
        <QuizEnded {...endedState} />
      </Layout>
    )
  }

  // keep the loader while checking whether a missing quiz has ended
  if ((loading && !data) || (sessionMissing && !statusData && !statusError)) {
    return (
      <Layout
        title={t('control.liveQuiz.liveQuizControl')}
        header={
          <AppBar title={t('control.liveQuiz.liveQuizControl')} backHref="/" />
        }
      >
        <Loader />
      </Layout>
    )
  }

  // a single failed poll keeps the last state on screen; only show the
  // error when there is nothing to control
  if (!data?.controlLiveQuiz) {
    return (
      <Layout
        title={t('control.liveQuiz.liveQuizControl')}
        header={
          <AppBar title={t('control.liveQuiz.liveQuizControl')} backHref="/" />
        }
      >
        <UserNotification
          message={t('control.liveQuiz.errorLoadingLiveQuiz')}
          type="error"
        />
      </Layout>
    )
  }

  const { id, name, course, isAssessmentEnabled } = data.controlLiveQuiz
  const backHref = course ? `/course/${course.id}` : '/course/unassigned'
  const blocks = sort(
    data.controlLiveQuiz.blocks ?? [],
    (a, b) => a.order - b.order
  )

  const header = (
    <AppBar
      title={name}
      eyebrow={
        isAssessmentEnabled ? t('control.course.assessmentBadge') : undefined
      }
      backHref={backHref}
      actions={
        <Button
          onClick={() => setEmbedOpen(true)}
          className={{ root: iconButtonClass }}
          aria-label={t('control.course.pptEmbedding')}
          data={{ cy: 'session-ppt-link' }}
        >
          <FontAwesomeIcon icon={faPersonChalkboard} className="h-4 w-4" />
        </Button>
      }
    />
  )

  if (blocks.length === 0) {
    return (
      <Layout title={name} header={header}>
        <UserNotification
          type="warning"
          message={t('control.liveQuiz.containsNoQuestions')}
        />
      </Layout>
    )
  }

  const activeBlock = blocks.find(
    (block) => block.status === ElementBlockStatus.Active
  )
  const nextBlock = blocks.find(
    (block) => block.status === ElementBlockStatus.Scheduled
  )
  // evaluation: the running block, otherwise the most recently closed one
  const evaluationBlock =
    activeBlock ??
    findLast(blocks, (block) => block.status === ElementBlockStatus.Executed)
  // a new evaluated block starts at its first question
  const selectedIndex =
    selectedQuestion.blockId === evaluationBlock?.id
      ? selectedQuestion.index
      : 0
  const selectQuestion = (index: number) =>
    setSelectedQuestion({ blockId: evaluationBlock?.id ?? null, index })

  // one main action per state: close the running block, start the next one,
  // or end the quiz once all blocks are done
  const renderMainAction = () => {
    if (activeBlock) {
      return (
        <Button
          loading={deactivatingBlock}
          onClick={() =>
            runAction(() =>
              deactivateLiveQuizBlock({
                variables: { quizId: id, blockId: activeBlock.id },
              })
            )
          }
          className={{ root: `${largeButtonClass} ${primaryButtonClass}` }}
          data={{ cy: 'deactivate-block' }}
        >
          <FontAwesomeIcon icon={faStop} className="h-3 w-3" />
          {t('control.liveQuiz.closeBlockN', { number: activeBlock.order + 1 })}
        </Button>
      )
    }
    if (nextBlock) {
      return (
        <Button
          loading={activatingBlock}
          onClick={() =>
            runAction(() =>
              activateLiveQuizBlock({
                variables: { quizId: id, blockId: nextBlock.id },
              })
            )
          }
          className={{ root: `${largeButtonClass} ${primaryButtonClass}` }}
          data={{ cy: 'activate-next-block' }}
        >
          <FontAwesomeIcon icon={faPlay} className="h-3 w-3" />
          {t('control.liveQuiz.startBlockN', { number: nextBlock.order + 1 })}
        </Button>
      )
    }
    return (
      <Button
        onClick={() => setEndSheetOpen(true)}
        className={{ root: `${largeButtonClass} ${dangerButtonClass}` }}
        data={{ cy: 'end-live-quiz' }}
      >
        {t('control.liveQuiz.endQuiz')}
      </Button>
    )
  }
  const mainAction = renderMainAction()

  return (
    <Layout title={name} header={header}>
      <BlockProgress blocks={blocks} />
      <SessionTabs
        tab={tab}
        onChange={setTab}
        pendingQuestions={pendingQuestions}
      />

      {tab === 'qa' ? (
        <div className="mt-4 max-w-[720px]">
          {qa ? <QAPanel quizId={id} data={qa} /> : <Loader />}
        </div>
      ) : tab === 'stats' ? (
        <div className="mt-4">
          <StatsPanel
            quizId={id}
            blocks={blocks}
            isAssessment={isAssessmentEnabled}
            questions={
              qa && (qa.isLiveQAEnabled || (qa.feedbacks?.length ?? 0) > 0)
                ? {
                    total: qa.feedbacks?.length ?? 0,
                    unanswered: (qa.feedbacks ?? []).filter(
                      (feedback) => !feedback.isResolved
                    ).length,
                  }
                : undefined
            }
          />
        </div>
      ) : (
        <>
          {/* bottom padding keeps content clear of the fixed action bar on phones */}
          {/* one grid item per card (no duplicated test hooks): phones stack them,
          from 720px status + evaluation sit left, action + Leinwand right */}
          <div className="mt-4 grid grid-cols-[minmax(0,1fr)] items-start gap-4 pb-[calc(5rem_+_env(safe-area-inset-bottom))] min-[720px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] min-[720px]:pb-0">
            <div className="flex min-w-0 flex-col gap-3 min-[720px]:row-span-2">
              <BlockStatusCard
                quizId={id}
                activeBlock={activeBlock}
                nextBlock={nextBlock}
                numOfBlocks={blocks.length}
                isAssessment={isAssessmentEnabled}
              />
              {evaluationBlock && (
                <LiveEvaluationCard
                  key={evaluationBlock.id}
                  quizId={id}
                  blockOrder={evaluationBlock.order}
                  live={!!activeBlock}
                  isAssessment={isAssessmentEnabled}
                  selected={selectedIndex}
                  onSelect={selectQuestion}
                />
              )}
            </div>
            {/* fixed bottom bar on phones, sticky right column from 720px */}
            <div className="border-ctrl-border fixed inset-x-0 bottom-0 z-10 border-t bg-white p-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))] min-[720px]:sticky min-[720px]:top-[72px] min-[720px]:z-auto min-[720px]:col-start-2 min-[720px]:row-start-1 min-[720px]:border-0 min-[720px]:bg-transparent min-[720px]:p-0">
              {mainAction}
            </div>
            {evaluationBlock && (
              <div className="min-w-0 min-[720px]:col-start-2 min-[720px]:row-start-2">
                <LeinwandCard
                  quizId={id}
                  blockOrder={evaluationBlock.order}
                  selected={selectedIndex}
                  live={!!activeBlock}
                  isAssessment={isAssessmentEnabled}
                />
              </div>
            )}
          </div>
        </>
      )}

      <ResponsiveSheet
        open={endSheetOpen}
        onClose={() => setEndSheetOpen(false)}
        title={t('control.liveQuiz.endSheetTitle')}
        dataCy="end-live-quiz-sheet"
        actions={
          <>
            <Button
              onClick={() => setEndSheetOpen(false)}
              className={{ root: `${sheetButtonClass} ${outlineButtonClass}` }}
              data={{ cy: 'cancel-end-live-quiz' }}
            >
              {t('shared.generic.cancel')}
            </Button>
            <Button
              loading={endingLiveQuiz}
              onClick={() =>
                runAction(async () => {
                  const result = await endLiveQuiz({ variables: { id } })
                  // a null result means the quiz was not ended (e.g. changed
                  // state meanwhile); keep the controls instead of "ended"
                  if (!result.data?.endLiveQuiz) {
                    throw new Error('live quiz not ended')
                  }
                  setEndSheetOpen(false)
                  setEnded({ name, numOfBlocks: blocks.length, backHref })
                })
              }
              className={{ root: `${sheetButtonClass} ${dangerButtonClass}` }}
              data={{ cy: 'confirm-end-live-quiz' }}
            >
              {t('control.liveQuiz.endConfirm')}
            </Button>
          </>
        }
      >
        {t('control.liveQuiz.endSheetBody')}
      </ResponsiveSheet>

      {embedOpen && (
        <EmbeddingModal quizId={id} onClose={() => setEmbedOpen(false)} />
      )}
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default RunningLiveQuiz
