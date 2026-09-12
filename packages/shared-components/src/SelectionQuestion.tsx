import type {
  SelectionElementOptions,
  SelectionInstanceEvaluation,
} from '@klicker-uzh/graphql/dist/ops'
import { useMemo } from 'react'
import PracticeQuizPoints from './evaluation/PracticeQuizPoints'
import QuestionExplanation from './evaluation/QuestionExplanation'
import SEEValuation from './evaluation/SEEvaluation'
import QuestionContent from './QuestionContent'
import SELECTIONAnswerOptions from './questions/SELECTIONAnswerOptions'
import type { SelectionStudentResponseType } from './StudentElement'
import completeSelectionResponse from './utils/completeSelectionResponse'
import getEmptySelectionResponse from './utils/getEmptySelectionResponse'
import { validateSelectionResponse } from './utils/validateResponse'

interface SelectionQuestionProps {
  content: string
  options: SelectionElementOptions
  response?: SelectionStudentResponseType
  valid: boolean
  setResponse: (newValue: SelectionStudentResponseType, valid: boolean) => void
  existingResponse?: SelectionStudentResponseType
  elementIx: number
  evaluation?: SelectionInstanceEvaluation
  disabled?: boolean
  noPoints: boolean
  preview: boolean
}

function SelectionQuestion({
  content,
  options,
  response,
  valid,
  setResponse,
  existingResponse,
  elementIx,
  evaluation,
  disabled,
  noPoints,
  preview = false,
}: SelectionQuestionProps) {
  const emptyResponses = useMemo(
    () =>
      getEmptySelectionResponse({
        numberOfInputs: options.numberOfInputs,
      }),
    [options.numberOfInputs]
  )

  // complete the existing response with -1 for missing keys
  const completedExistingResponse = useMemo(
    () =>
      completeSelectionResponse({
        existingResponse,
        emptyResponses,
      }),
    [existingResponse, emptyResponses]
  )

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="flex-1">
        <QuestionContent content={content} noPoints={noPoints} />

        {evaluation && evaluation.explanation && (
          <QuestionExplanation explanation={evaluation.explanation} />
        )}

        <SELECTIONAnswerOptions
          responses={completedExistingResponse ?? response ?? emptyResponses}
          onChange={(newValue) => {
            const valid = validateSelectionResponse({ response: newValue })
            setResponse(newValue, valid)
          }}
          options={options}
          disabled={disabled || !!existingResponse}
          elementIx={elementIx}
          preview={preview}
        />
      </div>

      {evaluation && evaluation.answerSolutionIds && !preview ? (
        <div
          className="col-span-1 mr-2 rounded-md border border-solid bg-slate-50 px-2 py-4 md:ml-2 md:mr-0 md:w-64 md:px-0 lg:w-80"
          key={`evaluation-${elementIx}`}
        >
          <div className="flex flex-col gap-4 md:px-4">
            <div className="flex flex-row justify-between">
              <PracticeQuizPoints evaluation={evaluation} />
            </div>
            <SEEValuation evaluation={evaluation} options={options} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default SelectionQuestion
