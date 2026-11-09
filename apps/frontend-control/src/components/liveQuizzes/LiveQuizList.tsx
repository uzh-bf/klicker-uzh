import { PublicationStatus } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import ListRow from '../common/ListRow'
import LiveDot from '../common/LiveDot'
import {
  cardClass,
  outlineButtonClass,
  primaryButtonClass,
  smallButtonClass,
} from '../common/styles'
import StartLiveQuizSheet, { type StartableQuiz } from './StartLiveQuizSheet'

export interface ControlLiveQuiz extends StartableQuiz {
  status: PublicationStatus
  availableFrom?: string | Date | null
}

interface LiveQuizListProps {
  liveQuizzes: ControlLiveQuiz[]
}

const STARTABLE = [PublicationStatus.Draft, PublicationStatus.Scheduled]

function QuizStatus({ quiz }: { quiz: ControlLiveQuiz }) {
  const t = useTranslations()

  if (quiz.status === PublicationStatus.Published) {
    return (
      <>
        <LiveDot className="h-1.5 w-1.5" />
        <span className="text-uzh-red font-semibold">
          {t('control.course.statusRunning')}
        </span>
      </>
    )
  }
  if (quiz.status !== PublicationStatus.Scheduled) {
    return <span>{t('control.course.statusReady')}</span>
  }
  if (!quiz.availableFrom) {
    return <span>{t('control.course.statusScheduled')}</span>
  }
  return (
    <span>
      {t('control.course.statusScheduledAt', {
        date: dayjs(quiz.availableFrom).format('DD.MM.YYYY, HH:mm'),
      })}
    </span>
  )
}

function QuizMeta({ quiz }: { quiz: ControlLiveQuiz }) {
  const t = useTranslations()

  return (
    <>
      {quiz.isAssessmentEnabled && (
        <span className="bg-ctrl-info-bg text-ctrl-info rounded px-1.5 py-0.5 text-xs font-semibold">
          {t('control.course.assessmentBadge')}
        </span>
      )}
      <QuizStatus quiz={quiz} />
    </>
  )
}

function LiveQuizList({ liveQuizzes }: LiveQuizListProps) {
  const t = useTranslations()
  const router = useRouter()
  const [startQuiz, setStartQuiz] = useState<StartableQuiz | null>(null)

  // running quizzes first, then the ones that can still be started
  const quizzes = [
    ...liveQuizzes.filter((q) => q.status === PublicationStatus.Published),
    ...liveQuizzes.filter((q) => STARTABLE.includes(q.status)),
  ]

  return (
    <>
      <h2 className="text-ctrl-ink text-xl font-bold">
        {t('control.course.liveQuizzes')}
      </h2>

      {quizzes.length > 0 ? (
        <div className={twMerge(cardClass, 'mt-2 overflow-hidden')}>
          {quizzes.map((quiz) => {
            const running = quiz.status === PublicationStatus.Published
            const open = () =>
              running ? router.push(`/session/${quiz.id}`) : setStartQuiz(quiz)

            return (
              <ListRow
                key={quiz.id}
                title={quiz.name}
                onClick={open}
                dataCy={`live-quiz-row-${quiz.name}`}
                meta={<QuizMeta quiz={quiz} />}
                actions={
                  <Button
                    onClick={open}
                    className={{
                      root: twMerge(
                        smallButtonClass,
                        running ? primaryButtonClass : outlineButtonClass
                      ),
                    }}
                    data={{
                      cy: running
                        ? `running-live-quiz-${quiz.name}`
                        : `start-live-quiz-${quiz.name}`,
                    }}
                  >
                    {running
                      ? t('control.course.controlQuiz')
                      : t('shared.generic.start')}
                  </Button>
                }
              />
            )
          })}
        </div>
      ) : (
        <p className="text-ctrl-muted mt-2 text-sm">
          {t('control.course.noLiveQuizzes')}
        </p>
      )}

      <p className="text-ctrl-muted mt-4 text-sm">
        {t('control.course.completedLiveQuizzesHint')}
      </p>

      <StartLiveQuizSheet quiz={startQuiz} onClose={() => setStartQuiz(null)} />
    </>
  )
}

export default LiveQuizList
