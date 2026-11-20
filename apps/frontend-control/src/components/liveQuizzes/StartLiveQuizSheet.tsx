import { useMutation } from '@apollo/client'
import { faPlay } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetControlCourseLiveQuizzesDocument,
  GetControlCourseOverviewDocument,
  GetUnassignedControlLiveQuizzesDocument,
  GetUserRunningLiveQuizzesDocument,
  StartLiveQuizDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, toast } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import ResponsiveSheet from '../common/ResponsiveSheet'
import {
  outlineButtonClass,
  primaryButtonClass,
  sheetButtonClass,
} from '../common/styles'

export interface StartableQuiz {
  id: string
  name: string
  isAssessmentEnabled?: boolean
}

interface StartLiveQuizSheetProps {
  quiz: StartableQuiz | null
  onClose: () => void
}

function StartLiveQuizSheet({ quiz, onClose }: StartLiveQuizSheetProps) {
  const t = useTranslations()
  const router = useRouter()
  const [startLiveQuiz, { loading: startingLiveQuiz }] = useMutation(
    StartLiveQuizDocument,
    {
      // active lists, the course overview counts and the running banner
      refetchQueries: [
        GetControlCourseLiveQuizzesDocument,
        GetUnassignedControlLiveQuizzesDocument,
        GetControlCourseOverviewDocument,
        GetUserRunningLiveQuizzesDocument,
      ],
    }
  )

  return (
    <ResponsiveSheet
      open={!!quiz}
      onClose={onClose}
      title={t('control.course.startSheetTitle')}
      dataCy="start-live-quiz-sheet"
      actions={
        <>
          <Button
            onClick={onClose}
            className={{ root: `${sheetButtonClass} ${outlineButtonClass}` }}
            data={{ cy: 'cancel-start-live-quiz-modal' }}
          >
            {t('shared.generic.cancel')}
          </Button>
          <Button
            loading={startingLiveQuiz}
            onClick={async () => {
              if (!quiz) return
              try {
                await startLiveQuiz({ variables: { id: quiz.id } })
                router.push(`/session/${quiz.id}`)
              } catch {
                onClose()
                toast({
                  type: 'error',
                  message: t('control.course.liveQuizStartFailed'),
                  options: { duration: 5000 },
                })
              }
            }}
            className={{ root: `${sheetButtonClass} ${primaryButtonClass}` }}
            data={{ cy: 'confirm-start-live-quiz' }}
          >
            <FontAwesomeIcon icon={faPlay} className="h-3 w-3" />
            {t('shared.generic.start')}
          </Button>
        </>
      }
    >
      {quiz && (
        <>
          <p>
            {t.rich('control.course.startSheetBody', {
              name: quiz.name,
              b: (chunks) => <b className="text-ctrl-ink">{chunks}</b>,
            })}
          </p>
          {quiz.isAssessmentEnabled && (
            <p
              className="bg-ctrl-info-bg text-ctrl-info mt-3 rounded-md p-3 text-sm"
              data-cy="start-live-quiz-assessment-hint"
            >
              {t.rich('control.course.assessmentStartHint', {
                b: (chunks) => <b>{chunks}</b>,
              })}
            </p>
          )}
        </>
      )}
    </ResponsiveSheet>
  )
}

export default StartLiveQuizSheet
