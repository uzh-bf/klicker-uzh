import {
  faCalendar,
  faPersonChalkboard,
  faPlay,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, H4 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import ListButton from '../common/ListButton'
import ErrorStartToast from '../toasts/ErrorStartToast'
import EmbeddingModal from './EmbeddingModal'
import StartModal from './StartModal'

interface LiveQuizListsProps {
  runningLiveQuizzes: { id: string; name: string }[]
  plannedLiveQuizzes: { id: string; name: string }[]
}

function LiveQuizLists({
  runningLiveQuizzes,
  plannedLiveQuizzes,
}: LiveQuizListsProps) {
  const t = useTranslations()
  const [startModalOpen, setStartModalOpen] = useState(false)
  const [errorToast, setErrorToast] = useState(false)
  const [startId, setStartId] = useState('')
  const [startName, setStartName] = useState('')
  const [embedOpen, setEmbedOpen] = useState(false)
  const [quizId, setQuizId] = useState('')

  return (
    <>
      <H4>{t('control.course.runningLiveQuizzes')}</H4>
      {runningLiveQuizzes.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {runningLiveQuizzes.map((quiz) => (
            <div key={quiz.id} className="flex flex-row items-center gap-2">
              <ListButton
                link={`/session/${quiz.id}`}
                icon={faPlay}
                label={quiz.name}
                className={{ icon: 'mr-1', root: 'flex-1' }}
                data={{ cy: `start-live-quiz-${quiz.name}` }}
              />
              <Button
                onClick={() => {
                  setEmbedOpen(true)
                  setQuizId(quiz.id)
                }}
                className={{
                  root: 'bg-uzh-grey-40 border-uzh-grey-100 h-full rounded-md border border-solid p-2',
                }}
                data={{ cy: `ppt-link-${quiz.name}` }}
              >
                <Button.Icon className={{ root: 'mr-2' }}>
                  <FontAwesomeIcon icon={faPersonChalkboard} />
                </Button.Icon>
                <Button.Label>PPT</Button.Label>
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div>{t('control.course.noRunningLiveQuizzes')}</div>
      )}

      <H4 className={{ root: 'mt-4' }}>
        {t('control.course.plannedLiveQuizzes')}
      </H4>
      {plannedLiveQuizzes.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {plannedLiveQuizzes.map((quiz) => (
            <div key={quiz.id} className="flex flex-row items-center gap-2">
              <ListButton
                key={quiz.id}
                icon={faCalendar}
                label={quiz.name}
                className={{ icon: 'mr-1' }}
                onClick={() => {
                  setStartModalOpen(true)
                  setStartId(quiz.id)
                  setStartName(quiz.name)
                }}
                data={{ cy: `start-live-quiz-${quiz.name}` }}
              />
              <Button
                onClick={() => {
                  setEmbedOpen(true)
                  setQuizId(quiz.id)
                }}
                className={{
                  root: 'bg-uzh-grey-40 border-uzh-grey-100 h-full rounded-md border border-solid p-2',
                }}
                data={{ cy: `ppt-link-${quiz.name}` }}
              >
                <Button.Icon className={{ root: 'mr-2' }}>
                  <FontAwesomeIcon icon={faPersonChalkboard} />
                </Button.Icon>
                <Button.Label>PPT</Button.Label>
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div>{t('control.course.noPlannedLiveQuizzes')}</div>
      )}

      <EmbeddingModal
        open={embedOpen}
        setOpen={(newValue: boolean) => setEmbedOpen(newValue)}
        quizId={quizId}
      />
      <StartModal
        quizId={startId}
        quizName={startName}
        startModalOpen={startModalOpen}
        setStartModalOpen={setStartModalOpen}
        setErrorToast={setErrorToast}
      />
      <ErrorStartToast open={errorToast} setOpen={setErrorToast} />
    </>
  )
}

export default LiveQuizLists
