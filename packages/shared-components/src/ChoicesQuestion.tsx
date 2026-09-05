import type {
  ChoiceElementOptions,
  ChoicesInstanceEvaluation,
} from '@klicker-uzh/graphql/dist/ops'
import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import MCKPRIMEvaluation from './evaluation/MCKPRIMEvaluation'
import PracticeQuizPoints from './evaluation/PracticeQuizPoints'
import QuestionExplanation from './evaluation/QuestionExplanation'
import SCEvaluation from './evaluation/SCEvaluation'
import QuestionContent from './QuestionContent'
import KPAnswerOptions from './questions/KPAnswerOptions'
import MCAnswerOptions from './questions/MCAnswerOptions'
import SCAnswerOptions from './questions/SCAnswerOptions'
import type { ChoicesStudentResponseType } from './StudentElement'
import {
  validateKprimResponse,
  validateMcResponse,
  validateScResponse,
} from './utils/validateResponse'

interface ChoicesQuestionProps {
  preview?: boolean
  content: string
  type: ElementType.Sc | ElementType.Mc | ElementType.Kprim
  options: ChoiceElementOptions
  response?: ChoicesStudentResponseType
  setResponse: (newValue: ChoicesStudentResponseType, valid: boolean) => void
  existingResponse?: ChoicesStudentResponseType
  elementIx: number
  evaluation?: ChoicesInstanceEvaluation
  noPoints: boolean
  disabled?: boolean
}

function ChoicesQuestion({
  preview = false,
  content,
  type,
  options,
  response,
  setResponse,
  existingResponse,
  elementIx,
  evaluation,
  noPoints,
  disabled,
}: ChoicesQuestionProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="flex-1">
        <QuestionContent content={content} noPoints={noPoints} />

        {evaluation && evaluation.explanation && (
          <QuestionExplanation explanation={evaluation.explanation} />
        )}

        {type === ElementType.Kprim && (
          <KPAnswerOptions
            displayMode={options.displayMode}
            type={ElementType.Kprim}
            choices={options.choices}
            feedbacks={evaluation?.feedbacks}
            value={existingResponse ?? response}
            onChange={(newValue: ChoicesStudentResponseType) => {
              const valid = validateKprimResponse({ response: newValue })
              setResponse(newValue, valid)
            }}
            elementIx={elementIx}
            disabled={disabled || !!existingResponse}
          />
        )}

        {type === ElementType.Mc && (
          <MCAnswerOptions
            displayMode={options.displayMode}
            choices={options.choices}
            feedbacks={evaluation?.feedbacks}
            value={existingResponse ?? response}
            onChange={(newValue: ChoicesStudentResponseType) => {
              const valid = validateMcResponse({ response: newValue })
              setResponse(newValue, valid)
            }}
            elementIx={elementIx}
            disabled={disabled || !!existingResponse}
          />
        )}

        {type === ElementType.Sc && (
          <SCAnswerOptions
            displayMode={options.displayMode}
            choices={options.choices}
            feedbacks={evaluation?.feedbacks}
            value={existingResponse ?? response}
            onChange={(newValue: ChoicesStudentResponseType) => {
              const valid = validateScResponse({ response: newValue })
              setResponse(newValue, valid)
            }}
            elementIx={elementIx}
            disabled={disabled || !!existingResponse}
          />
        )}
      </div>

      {evaluation && !preview ? (
        <div
          className="col-span-1 mr-2 rounded-md border border-solid bg-slate-50 px-2 py-4 md:ml-2 md:mr-0 md:w-64 md:px-0 lg:w-80"
          key={`evaluation-${elementIx}`}
        >
          <div className="flex flex-col gap-4 md:px-4">
            <div className="flex flex-row justify-between">
              <PracticeQuizPoints evaluation={evaluation} />
            </div>
            {type === ElementType.Sc && (
              <SCEvaluation evaluation={evaluation} />
            )}
            {(type === ElementType.Mc || type === ElementType.Kprim) && (
              <MCKPRIMEvaluation evaluation={evaluation} />
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default ChoicesQuestion
