import { useLazyQuery, useMutation } from '@apollo/client'
import { faChevronRight, faStop } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  DeactivateLiveQuizBlockDocument,
  ElementBlockStatus,
  EndLiveQuizDocument,
  GetControlCourseLiveQuizzesDocument,
  GetControlCourseOverviewDocument,
  GetControlLiveQuizSessionDocument,
  GetUnassignedControlLiveQuizzesDocument,
  GetUserRunningLiveQuizzesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, toast } from '@uzh-bf/design-system'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import LiveDot from '../common/LiveDot'
import ResponsiveSheet from '../common/ResponsiveSheet'
import {
  dangerButtonClass,
  outlineButtonClass,
  sheetButtonClass,
} from '../common/styles'

interface RunningQuizBannerProps {
  quiz: { id: string; name: string }
}

// Banner for a running quiz on the course overview: tap to control it, or
// stop it directly (closes a running block first so its results are saved)
function RunningQuizBanner({ quiz }: RunningQuizBannerProps) {
  const t = useTranslations()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [stopping, setStopping] = useState(false)

  const [loadSession, { data, loading }] = useLazyQuery(
    GetControlLiveQuizSessionDocument,
    { fetchPolicy: 'network-only' }
  )
  const [deactivateBlock] = useMutation(DeactivateLiveQuizBlockDocument)
  const [endLiveQuiz] = useMutation(EndLiveQuizDocument, {
    // the ended quiz leaves the banner, the overview counts and the lists
    refetchQueries: [
      GetUserRunningLiveQuizzesDocument,
      GetControlCourseOverviewDocument,
      GetControlCourseLiveQuizzesDocument,
      GetUnassignedControlLiveQuizzesDocument,
    ],
  })

  const blocks = data?.controlLiveQuiz?.blocks ?? []
  const activeBlock = blocks.find(
    (block) => block.status === ElementBlockStatus.Active
  )
  const notStarted = blocks.filter(
    (block) => block.status === ElementBlockStatus.Scheduled
  ).length

  const stop = async () => {
    setStopping(true)
    try {
      // fetch the current state again: a block may have changed meanwhile
      const { data: current } = await loadSession({
        variables: { id: quiz.id },
      })
      // without the current state a running block could not be closed and
      // its answers would be lost, so do not end the quiz
      if (!current?.controlLiveQuiz) {
        throw new Error('failed to load the current quiz state')
      }
      const running = current.controlLiveQuiz.blocks?.find(
        (block) => block.status === ElementBlockStatus.Active
      )
      if (running) {
        await deactivateBlock({
          variables: { quizId: quiz.id, blockId: running.id },
        })
      }
      const result = await endLiveQuiz({ variables: { id: quiz.id } })
      if (!result.data?.endLiveQuiz) throw new Error('live quiz not ended')
      setSheetOpen(false)
      toast({
        type: 'success',
        message: t('control.home.quizStopped', { name: quiz.name }),
        options: { duration: 4000 },
      })
    } catch {
      toast({
        type: 'error',
        message: t('control.liveQuiz.actionFailed'),
        options: { duration: 5000 },
      })
    } finally {
      setStopping(false)
    }
  }

  return (
    <div
      className="bg-uzh-blue mb-4 flex items-center rounded-md text-white"
      data-cy={`running-banner-${quiz.name}`}
    >
      <Link
        href={`/session/${quiz.id}`}
        className="hover:bg-uzh-blue-80 flex min-w-0 flex-1 items-center gap-3 rounded-l-md p-4"
        data-cy={`running-banner-link-${quiz.name}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-bold tracking-[0.06em] uppercase">
            <LiveDot />
            {t('control.home.running')}
          </div>
          <div className="mt-1 truncate text-lg font-bold">{quiz.name}</div>
        </div>
        <FontAwesomeIcon icon={faChevronRight} className="h-4 w-4" />
      </Link>
      <div className="self-stretch border-l border-white/25 p-3">
        <Button
          onClick={() => {
            setSheetOpen(true)
            loadSession({ variables: { id: quiz.id } })
          }}
          className={{
            root: 'h-full min-h-11 gap-2 border-white/60 bg-transparent px-3 text-sm font-semibold text-white hover:bg-white/15 hover:text-white',
          }}
          data={{ cy: `stop-running-quiz-${quiz.name}` }}
        >
          <FontAwesomeIcon icon={faStop} className="h-3 w-3" />
          {t('control.home.stopQuiz')}
        </Button>
      </div>

      <ResponsiveSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('control.liveQuiz.endSheetTitle')}
        dataCy="stop-running-quiz-sheet"
        actions={
          <>
            <Button
              onClick={() => setSheetOpen(false)}
              className={{ root: `${sheetButtonClass} ${outlineButtonClass}` }}
              data={{ cy: 'cancel-stop-running-quiz' }}
            >
              {t('shared.generic.cancel')}
            </Button>
            <Button
              loading={stopping}
              disabled={loading}
              onClick={stop}
              className={{ root: `${sheetButtonClass} ${dangerButtonClass}` }}
              data={{ cy: 'confirm-stop-running-quiz' }}
            >
              {t('control.liveQuiz.endConfirm')}
            </Button>
          </>
        }
      >
        <p>
          {t.rich('control.home.stopSheetQuiz', {
            name: quiz.name,
            b: (chunks) => <b className="text-ctrl-ink">{chunks}</b>,
          })}
        </p>
        {loading && !data ? (
          <Loader />
        ) : (
          (activeBlock || notStarted > 0) && (
            <ul className="bg-ctrl-bg mt-3 flex list-disc flex-col gap-1 rounded-md py-3 pr-3 pl-7 text-sm">
              {activeBlock && (
                <li data-cy="stop-running-quiz-active-block">
                  {t('control.home.stopSheetActiveBlock', {
                    number: activeBlock.order + 1,
                  })}
                </li>
              )}
              {notStarted > 0 && (
                <li data-cy="stop-running-quiz-not-started">
                  {t('control.home.stopSheetNotStarted', {
                    count: notStarted,
                  })}
                </li>
              )}
            </ul>
          )
        )}
        <p className="mt-3">{t('control.liveQuiz.endSheetBody')}</p>
      </ResponsiveSheet>
    </div>
  )
}

export default RunningQuizBanner
