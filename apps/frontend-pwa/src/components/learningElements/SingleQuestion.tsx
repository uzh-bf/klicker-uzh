import { ElementType, QuestionInstance } from '@klicker-uzh/graphql/dist/ops'
import {
  validateFreeTextResponse,
  validateKprimResponseOld,
  validateMcResponseOld,
  validateNumericalResponse,
  validateScResponseOld,
} from '@klicker-uzh/shared-components/src/utils/validateResponse'
import { H3, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import OptionsDisplay from '../common/OptionsDisplay'
import FlagQuestionModal from '../flags/FlagQuestionModal'
import DynamicMarkdown from './DynamicMarkdown'

interface SingleQuestionProps {
  instance: QuestionInstance
  response: any
  setResponse: (response: any) => void
  setInputValid: (valid: boolean) => void
  withParticipant?: boolean
}

function SingleQuestion({
  instance,
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
      case ElementType.Sc:
        if (validateScResponseOld(questionResponse)) {
          setInputValid(true)
          break
        }
        setInputValid(false)
        break

      case ElementType.Mc:
        if (validateMcResponseOld(questionResponse)) {
          setInputValid(true)
          break
        }
        setInputValid(false)
        break

      case ElementType.Kprim:
        if (validateKprimResponseOld(questionResponse)) {
          setInputValid(true)
          break
        }
        setInputValid(false)
        break

      case ElementType.Numerical:
        if (
          validateNumericalResponse({
            response: questionResponse,
            options: instance.questionData?.options,
          })
        ) {
          setInputValid(true)
          break
        }
        setInputValid(false)
        break

      case ElementType.FreeText:
        if (
          validateFreeTextResponse({
            response: questionResponse,
            options: instance.questionData?.options,
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
            <H3
              className={{ root: 'mb-0' }}
              data={{ cy: 'question-stack-question-name' }}
            >
              {questionData.name}
            </H3>
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

          <div className="pb-2" data-cy="question-stack-question-content">
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
          />
        </div>
      </div>
    </div>
  )
}

export default SingleQuestion
