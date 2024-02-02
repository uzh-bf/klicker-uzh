import {
  InstanceEvaluation,
  NumericalQuestionOptions,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import NREvaluation from './evaluation/NREvaluation'
import PracticeQuizPoints from './evaluation/PracticeQuizPoints'
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
}: NumericalQuestionProps) {
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
          accuracy={options.accuracy ? options.accuracy : undefined}
          placeholder={options.placeholder ?? undefined}
          unit={options.unit ?? undefined}
          min={options.restrictions?.min ?? undefined}
          max={options.restrictions?.max ?? undefined}
          disabled={!!existingResponse}
          elementIx={elementIx}
        />
      </div>

      {evaluation && (
        <div
          className="col-span-1 px-2 py-4 mr-2 border border-solid md:w-64 lg:w-80 md:px-0 md:ml-2 md:mr-0 bg-slate-50"
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
