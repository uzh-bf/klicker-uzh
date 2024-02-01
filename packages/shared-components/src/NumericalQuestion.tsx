import { NumericalQuestionOptions } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import NUMERICALAnswerOptions from './questions/NUMERICALAnswerOptions'
import { validateNumericalResponse } from './utils/validateResponse'

interface NumericalQuestionProps {
  content: string
  options: NumericalQuestionOptions
  response?: number
  valid: boolean
  setResponse: (newValue: number, valid: boolean) => void
  existingResponse?: number
  elementIx: number
}

function NumericalQuestion({
  content,
  options,
  response,
  valid,
  setResponse,
  existingResponse,
  elementIx,
}: NumericalQuestionProps) {
  return (
    <div>
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
          setResponse(parseFloat(newValue), valid)
        }}
        valid={valid}
        accuracy={options.accuracy ? options.accuracy : undefined}
        placeholder={options.placeholder ?? undefined}
        unit={options.unit ?? undefined}
        min={options.restrictions?.min ?? undefined}
        max={options.restrictions?.max ?? undefined}
        disabled={!!existingResponse}
      />
    </div>
  )
}

export default NumericalQuestion
