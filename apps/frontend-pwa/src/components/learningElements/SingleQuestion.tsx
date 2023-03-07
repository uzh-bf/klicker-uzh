import { QuestionInstance, QuestionType } from '@klicker-uzh/graphql/dist/ops'
import { H3, UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
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
  setInputValid: (valid: boolean) => void
}

function SingleQuestion({
  instance,
  currentStep,
  totalSteps,
  response,
  setResponse,
  setInputValid,
}: SingleQuestionProps) {
  const t = useTranslations()

  const [modalOpen, setModalOpen] = useState(false)
  const [questionResponse, setQuestionResponse] = useState(response)

  useEffect(() => {
    setResponse(questionResponse)

    switch (instance.questionData.type) {
      case QuestionType.Sc:
        if (
          typeof questionResponse !== 'undefined' &&
          questionResponse?.length > 0
        ) {
          setInputValid(true)
          break
        }
        setInputValid(false)
        break

      case QuestionType.Mc:
        if (
          typeof questionResponse !== 'undefined' &&
          questionResponse?.length > 0
        ) {
          setInputValid(true)
          break
        }
        setInputValid(false)
        break

      case QuestionType.Kprim:
        if (
          typeof questionResponse !== 'undefined' &&
          Object.values(questionResponse).length === 4 &&
          Object.values(questionResponse).every(
            (value) => typeof value === 'boolean'
          )
        ) {
          setInputValid(true)
          break
        }
        setInputValid(false)
        break

      case QuestionType.Numerical:
        if (
          typeof questionResponse !== 'undefined' &&
          questionResponse !== '' &&
          questionResponse >= instance.questionData.options.restrictions.min &&
          questionResponse <= instance.questionData.options.restrictions.max
        ) {
          setInputValid(true)
          break
        }
        setInputValid(false)
        break

      case QuestionType.FreeText:
        // TODO: implement
        setInputValid(false)
        break

      default:
        setInputValid(false)
        break
    }
  }, [instance, questionResponse])

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
            response={questionResponse}
            onChangeResponse={setQuestionResponse}
            questionType={questionData.type}
            options={questionData.options}
            displayMode={questionData.displayMode}
          />
        </div>

        {instance.evaluation && (
          <div className="flex-1 pt-4 space-y-4 border-t md:p-4 md:border md:rounded md:bg-slate-50 basis-1/3">
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
                <div className="float-left text-lg">
                  {instance.evaluation.score} {t('shared.leaderboard.points')}
                </div>
              </div>
              {(instance.evaluation.pointsAwarded !== null ||
                instance.evaluation.xpAwarded !== null) && (
                <div>
                  <div className="font-bold">
                    {t('shared.leaderboard.collected')}
                  </div>
                  <div>
                    {instance.evaluation.pointsAwarded !== null && (
                      <div className="text-lg">
                        {instance.evaluation.pointsAwarded}{' '}
                        {t('shared.leaderboard.points')}
                      </div>
                    )}
                    {instance.evaluation.xpAwarded !== null && (
                      <div className="text-lg">
                        {instance.evaluation.xpAwarded} XP
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {(instance.evaluation.newPointsFrom !== null ||
              instance.evaluation.newXpFrom !== null) && (
              <div>
                <div className="font-bold">
                  {t('pwa.learningElement.newPointsFrom')}
                </div>
                {instance.evaluation.newPointsFrom !== null && (
                  <div className="text-lg">
                    {dayjs(instance.evaluation.newPointsFrom).format(
                      'DD.MM.YYYY HH:mm'
                    )}
                  </div>
                )}
                {instance.evaluation.newXpFrom !== null && (
                  <div className="text-lg">
                    {dayjs(instance.evaluation.newXpFrom).format(
                      'DD.MM.YYYY HH:mm'
                    )}
                  </div>
                )}
              </div>
            )}

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
