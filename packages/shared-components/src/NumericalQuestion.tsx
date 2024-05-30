import React from 'react'
import type {
  InstanceEvaluation,
  NumericalQuestionOptions,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { twMerge } from 'tailwind-merge'
import NREvaluation from './evaluation/NREvaluation'
import PracticeQuizPoints from './evaluation/PracticeQuizPoints'
import QuestionExplanation from './evaluation/QuestionExplanation'
import NUMERICALAnswerOptions from './questions/NUMERICALAnswerOptions'
import { validateNumericalResponse } from './utils/validateResponse'

interface NumericalQuestionProps {
  content: string
  options: NumericalQuestionOptions
  response?: string
  valid: boolean
  setResponse: (newValue: string, valid: boolean) => void
  existingResponse?: string
  elementIx: number
  evaluation?: InstanceEvaluation
  disabled?: boolean
}

function NumericalQuestion({
  content,
  options,
  response,
  valid,
  setResponse,
  existingResponse,
  elementIx,
  evaluation,
  disabled,
}: NumericalQuestionProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="flex-1">
        {content !== '<br>' && (
          <div
            className={twMerge(
              'bg-primary-10 prose mb-4 mt-4 min-h-[6rem] max-w-none flex-initial rounded border border-slate-300 p-4 leading-6 prose-p:!m-0 prose-img:!m-0'
            )}
          >
            <Markdown content={content} />
          </div>
        )}

        {evaluation && evaluation.explanation && (
          <QuestionExplanation explanation={evaluation.explanation} />
        )}

        <NUMERICALAnswerOptions
          value={
            existingResponse
              ? String(existingResponse)
              : response
              ? String(response)
              : undefined
          }
          onChange={(newValue) => {
            const valid = validateNumericalResponse({
              response: newValue,
              options,
            })
            setResponse(newValue, valid)
          }}
          valid={existingResponse ? !!existingResponse : valid}
          accuracy={options.accuracy ?? undefined}
          placeholder={options.placeholder ?? undefined}
          unit={options.unit ?? undefined}
          min={options.restrictions?.min ?? undefined}
          max={options.restrictions?.max ?? undefined}
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
            <NREvaluation
              options={{
                ...options,
                solutionRanges: evaluation.solutionRanges,
              }}
              evaluation={evaluation}
              reference={existingResponse}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default NumericalQuestion
