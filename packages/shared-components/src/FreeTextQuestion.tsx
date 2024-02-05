import {
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
}: FreeTextQuestionProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="flex-1">
        {content !== '<br>' && (
          <div
            className={twMerge(
              'mt-4 mb-4 border-slate-300 flex-initial min-h-[6rem] bg-primary-10 border rounded leading-6 prose max-w-none prose-p:!m-0 prose-img:!m-0 p-4'
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
          disabled={!!existingResponse}
          elementIx={elementIx}
        />
      </div>

      {evaluation && (
        <div
          className="col-span-1 px-2 py-4 mr-2 border border-solid rounded-md md:w-64 lg:w-80 md:px-0 md:ml-2 md:mr-0 bg-slate-50"
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
