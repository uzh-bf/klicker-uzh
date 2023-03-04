import { faBookmark } from '@fortawesome/free-regular-svg-icons'
import { faBookmark as faBookmarkSolid } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { QuestionInstance } from '@klicker-uzh/graphql/dist/ops'
import { Button, H3, UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import OptionsDisplay from '../common/OptionsDisplay'
import EvaluationDisplay from '../evaluation/EvaluationDisplay'
import FlagQuestionModal from '../flags/FlagQuestionModal'
import DynamicMarkdown from './DynamicMarkdown'

interface SingleQuestionProps {
  instance: QuestionInstance
  currentStep: number
  totalSteps: number
  response: any
  setResponse: (response: any) => void
}

function SingleQuestion({
  instance,
  currentStep,
  totalSteps,
  response,
  setResponse,
}: SingleQuestionProps) {
  const t = useTranslations()

  const [modalOpen, setModalOpen] = useState(false)

  const questionData = instance.questionData

  return (
    <div className="order-2 md:order-1">
      <div className="flex flex-col gap-4 md:gap-8 md:flex-row">
        <div className="flex-1 basis-2/3">
          <div className="flex flex-row items-center justify-between mb-4 border-b">
            <H3 className={{ root: 'mb-0' }}>{questionData.name}</H3>
            <div className="flex flex-row items-center gap-3">
              <div className="text-sm md:text-base text-slate-500">
                {t('pwa.learningElement.questionProgress', {
                  current: currentStep,
                  total: totalSteps,
                })}
              </div>
              <Button
                basic
                disabled
                className={{ root: 'mb-1' }}
                onClick={() => {
                  //   bookmarkQuestion({
                  //     variables: {
                  //       instanceId: currentInstance.id!,
                  //       courseId: courseId,
                  //       bookmarked: !currentInstance.isBookmarked,
                  //     },
                  //   })
                }}
              >
                {instance.isBookmarked ? (
                  <FontAwesomeIcon
                    className="text-red-600 hover:text-red-500"
                    icon={faBookmarkSolid}
                  />
                ) : (
                  <FontAwesomeIcon
                    className="hover:text-red-400"
                    icon={faBookmark}
                  />
                )}
              </Button>
              <FlagQuestionModal
                open={modalOpen}
                setOpen={setModalOpen}
                instanceId={instance.id!}
              />
            </div>
          </div>

          <div className="pb-2">
            <DynamicMarkdown content={questionData.content} />
          </div>
          {instance.evaluation && questionData.explanation && (
            <UserNotification
              notificationType="success"
              message=""
              className={{
                root: 'flex flex-row items-center mb-2 md:mb-4 gap-3 px-3',
                content: 'mt-0',
              }}
            >
              <div className="font-bold">{t('shared.generic.explanation')}</div>
              <DynamicMarkdown content={questionData.explanation} />
            </UserNotification>
          )}
          <OptionsDisplay
            key={instance.id}
            isEvaluation={!!instance.evaluation}
            evaluation={instance.evaluation}
            response={response}
            onChangeResponse={setResponse}
            questionType={questionData.type}
            options={questionData.options}
            displayMode={questionData.displayMode}
          />
        </div>

        {instance.evaluation && (
          <div className="flex-1 pt-4 space-y-4 border-t md:p-4 md:border md:rounded md:bg-gray-50 basis-1/3">
            <div className="flex justify-between">
              <div className="flex flex-row gap-2">
                {t.rich('pwa.learningElement.multiplicatorEval', {
                  mult: instance.pointsMultiplier,
                  b: (text) => <span className="font-bold">{text}</span>,
                })}
              </div>
            </div>
            <div className="flex flex-row gap-4 md:flex-wrap">
              <div>
                <div className="font-bold">
                  {t('shared.leaderboard.computed')}
                </div>
                <div className="text-lg">
                  {instance.evaluation.score} {t('shared.leaderboard.points')}
                </div>
              </div>
              <div>
                <div className="font-bold">
                  {t('shared.leaderboard.collected')}
                </div>
                <div className="text-lg">
                  {instance.evaluation.pointsAwarded}{' '}
                  {t('shared.leaderboard.points')}
                </div>
                <div className="text-lg">
                  {instance.evaluation.xpAwarded} XP
                </div>
              </div>
              <div>
                <div className="font-bold">
                  {t('pwa.learningElement.newPointsFrom')}
                </div>
                <div className="text-lg">
                  {dayjs(instance.evaluation.newPointsFrom).format(
                    'DD.MM.YYYY HH:mm'
                  )}
                </div>
                <div className="text-lg">
                  {dayjs(instance.evaluation.newXpFrom).format(
                    'DD.MM.YYYY HH:mm'
                  )}
                </div>
              </div>
            </div>

            <EvaluationDisplay
              options={questionData.options}
              questionType={questionData.type}
              evaluation={instance.evaluation}
              reference={String(response)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default SingleQuestion
