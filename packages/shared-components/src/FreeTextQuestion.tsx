import type {
  FreeTextQuestionOptions,
  InstanceEvaluation,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import FTEvaluation from './evaluation/FTEvaluation'
import PracticeQuizPoints from './evaluation/PracticeQuizPoints'
import QuestionExplanation from './evaluation/QuestionExplanation'
import FREETextAnswerOptions from './questions/FREETextAnswerOptions'
import { validateFreeTextResponse } from './utils/validateResponse'

interface FreeTextQuestionProps {
  content: string
  options: FreeTextQuestionOptions
  response?: string
  valid: boolean
  setResponse: (newValue: string, valid: boolean) => void
  existingResponse?: string
  elementIx: number
  evaluation?: InstanceEvaluation
  disabled?: boolean
}

function FreeTextQuestion({
  content,
  options,
  response,
  valid,
  setResponse,
  existingResponse,
  elementIx,
  evaluation,
  disabled,
}: FreeTextQuestionProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="flex-1">
        {content !== '<br>' && (
          <div
            className={twMerge(
              'bg-primary-10 prose prose-p:!m-0 prose-img:!m-0 mb-4 mt-4 min-h-[6rem] max-w-none flex-initial rounded border border-slate-300 p-4 leading-6'
            )}
          >
            <Markdown content={content} />
          </div>
        )}

        {evaluation && evaluation.explanation && (
          <QuestionExplanation explanation={evaluation.explanation} />
        )}

        <FREETextAnswerOptions
          value={existingResponse ?? response ?? ''}
          onChange={(newValue) => {
            const valid = validateFreeTextResponse({
              response: newValue,
              options,
            })
            setResponse(newValue, valid)
          }}
          maxLength={options.restrictions?.maxLength ?? undefined}
          disabled={disabled || !!existingResponse}
          elementIx={elementIx}
        />
      </div>

      {evaluation && (
        <div
          className="col-span-1 mr-2 rounded-md border border-solid bg-slate-50 px-2 py-4 md:ml-2 md:mr-0 md:w-64 md:px-0 lg:w-80"
          key={`evaluation-${elementIx}`}
        >
          <div className="flex flex-col gap-4 md:px-4">
            <div className="flex flex-row justify-between">
              <PracticeQuizPoints evaluation={evaluation} />
            </div>
            <FTEvaluation
              options={{
                ...options,
                solutions: evaluation.solutions,
              }}
              evaluation={evaluation}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default FreeTextQuestion
