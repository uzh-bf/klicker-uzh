import type { SelectionQuestionOptions } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import React, { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import QuestionExplanation from './evaluation/QuestionExplanation'
import SELECTIONAnswerOptions from './questions/SELECTIONAnswerOptions'
import { validateSelectionResponse } from './utils/validateResponse'

interface SelectionQuestionProps {
  content: string
  options: SelectionQuestionOptions
  response?: Record<number, number | undefined>
  valid: boolean
  setResponse: (
    newValue: Record<number, number | undefined>,
    valid: boolean
  ) => void
  existingResponse?: Record<number, number | undefined>
  elementIx: number
  evaluation?: any // TODO: update to type: SelectionInstanceEvaluation
  disabled?: boolean
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
}: SelectionQuestionProps) {
  const emptyResponses = useMemo(() => {
    const initResponses: Record<number, number | undefined> = {}
    for (let i = 0; i < (options.numberOfInputs ?? 0); i++) {
      initResponses[i] = undefined
    }
    return initResponses
  }, [options.answerCollection?.entries, options.numberOfInputs])

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
          responses={existingResponse ?? response ?? emptyResponses}
          onChange={(newValue) => {
            const valid = validateSelectionResponse({ response: newValue })
            setResponse(newValue, valid)
          }}
          options={options}
          disabled={disabled || !!existingResponse}
          elementIx={elementIx}
        />
      </div>

      {/* // TODO: implement evaluation view for asynchronous applications */}
      {evaluation && evaluation.solutions && <div>EVALUATION</div>}
    </div>
  )
}

export default SelectionQuestion
