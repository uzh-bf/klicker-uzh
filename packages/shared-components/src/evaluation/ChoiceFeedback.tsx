import { faCheck, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { QuestionFeedback } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import React from 'react'
import { twMerge } from 'tailwind-merge'

export interface ChoiceFeedbackProps {
  feedback: QuestionFeedback
}

function ChoiceFeedback({ feedback }: ChoiceFeedbackProps) {
  return (
    <div
      className={twMerge(
        'flex flex-row items-center gap-3 rounded-b border bg-gray-50 text-sm'
      )}
    >
      <div
        className={twMerge(
          'flex w-8 flex-col items-center justify-center self-stretch bg-gray-300 px-3 py-2 text-xs text-gray-600',
          feedback.correct
            ? 'bg-green-200 text-green-700'
            : 'bg-red-200 text-red-700'
        )}
      >
        <FontAwesomeIcon icon={feedback.correct ? faCheck : faX} />
      </div>
      <div className="py-2 text-gray-700">
        <Markdown content={feedback.feedback ?? undefined} />
      </div>
    </div>
  )
}

export default ChoiceFeedback
