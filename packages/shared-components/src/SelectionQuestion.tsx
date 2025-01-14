import type {
  SelectionInstanceEvaluation,
  SelectionQuestionOptions,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import React, { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import PracticeQuizPoints from './evaluation/PracticeQuizPoints'
import QuestionExplanation from './evaluation/QuestionExplanation'
import SEEValuation from './evaluation/SEEvaluation'
import SELECTIONAnswerOptions from './questions/SELECTIONAnswerOptions'
import completeSelectionResponse from './utils/completeSelectionResponse'
import getEmptySelectionResponse from './utils/getEmptySelectionResponse'
import { validateSelectionResponse } from './utils/validateResponse'

interface SelectionQuestionProps {
  content: string
  options: SelectionQuestionOptions
  response?: Record<number, number>
  valid: boolean
  setResponse: (newValue: Record<number, number>, valid: boolean) => void
  existingResponse?: Record<number, number>
  elementIx: number
  evaluation?: SelectionInstanceEvaluation
  disabled?: boolean
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
  preview,
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
        {content !== '<br>' && (
          <div
            className={twMerge(
              'bg-primary-10 prose prose-p:!m-0 prose-img:!m-0 mb-4 min-h-[6rem] max-w-none flex-initial rounded border border-slate-300 p-4 leading-6'
            )}
          >
            <Markdown content={content} />
          </div>
        )}

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

      {evaluation && evaluation.answerSolutionIds && (
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
      )}
    </div>
  )
}

export default SelectionQuestion
