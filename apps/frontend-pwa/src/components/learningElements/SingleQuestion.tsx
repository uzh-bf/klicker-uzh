import { QuestionInstance, QuestionType } from '@klicker-uzh/graphql/dist/ops'
import {
  validateFreeTextResponse,
  validateKprimResponse,
  validateMcResponse,
  validateNumericalResponse,
  validateScResponse,
} from '@klicker-uzh/shared-components/src/utils/validateResponse'
import { H3, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import OptionsDisplay from '../common/OptionsDisplay'
import FlagQuestionModal from '../flags/FlagQuestionModal'
import DynamicMarkdown from './DynamicMarkdown'

interface SingleQuestionProps {
  instance: QuestionInstance
  currentStep: number
  totalSteps: number
  response: any
  setResponse: (response: any) => void
  setInputValid: (valid: boolean) => void
  withParticipant?: boolean
}

function SingleQuestion({
  instance,
  currentStep,
  totalSteps,
  response,
  setResponse,
  setInputValid,
  withParticipant = false,
}: SingleQuestionProps) {
  const t = useTranslations()

  const [modalOpen, setModalOpen] = useState(false)
  const [questionResponse, setQuestionResponse] = useState(response)

  useEffect(() => {
    setResponse(questionResponse)

    switch (instance.questionData.type) {
      case QuestionType.Sc:
        if (validateScResponse(questionResponse)) {
          setInputValid(true)
          break
        }
        setInputValid(false)
        break

      case QuestionType.Mc:
        if (validateMcResponse(questionResponse)) {
          setInputValid(true)
          break
        }
        setInputValid(false)
        break

      case QuestionType.Kprim:
        if (validateKprimResponse(questionResponse)) {
          setInputValid(true)
          break
        }
        setInputValid(false)
        break

      case QuestionType.Numerical:
        if (
          validateNumericalResponse({
            response: questionResponse,
            min: instance.questionData.options.restrictions.min,
            max: instance.questionData.options.restrictions.max,
          })
        ) {
          setInputValid(true)
          break
        }
        setInputValid(false)
        break

      case QuestionType.FreeText:
        if (
          validateFreeTextResponse({
            response: questionResponse,
            maxLength: instance.questionData.options.restrictions.maxLength,
          })
        ) {
          setInputValid(true)
          break
        }
        setInputValid(false)
        break

      default:
        setInputValid(false)
        break
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance, questionResponse])

  const questionData = instance.questionData

  return (
    <div className="order-2 md:order-1">
      <div className="flex flex-col gap-4 md:gap-8 md:flex-row">
        <div className="flex-1 basis-2/3">
          <div className="flex flex-row items-center justify-between mb-4 border-b">
            <H3 className={{ root: 'mb-0' }}>{questionData.name}</H3>
            <div className="flex flex-row items-center gap-3">
              {withParticipant && (
                <FlagQuestionModal
                  open={modalOpen}
                  setOpen={setModalOpen}
                  instanceId={instance.id!}
                />
              )}
            </div>
          </div>

          <div className="pb-2">
            <DynamicMarkdown content={questionData.content} />
          </div>
          {instance.evaluation && questionData.explanation && (
            <UserNotification
              type="success"
              message=""
              className={{
                root: 'flex flex-row items-center mb-2 md:mb-4 gap-3 px-3',
                content: 'mt-0',
              }}
            >
              <div className="font-bold">{t('shared.generic.explanation')}</div>
              <DynamicMarkdown
                className={{
                  root: 'prose prose-sm max-w-none text-green-800 prose-p:mt-0 prose-p:mb-1',
                }}
                content={questionData.explanation}
              />
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
      </div>
    </div>
  )
}

export default SingleQuestion
