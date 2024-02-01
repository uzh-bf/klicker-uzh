import { FreeTextQuestionOptions } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface FreeTextQuestionProps {
  content: string
  options: FreeTextQuestionOptions
  response?: string
  valid: boolean
  setResponse: (newValue: string, valid: boolean) => void
  existingResponse?: string
  elementIx: number
}

function FreeTextQuestion({
  content,
  options,
  response,
  valid,
  setResponse,
  existingResponse,
  elementIx,
}: FreeTextQuestionProps) {
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

      <div>FREE TEXT INPUT</div>
    </div>
  )
}

export default FreeTextQuestion
