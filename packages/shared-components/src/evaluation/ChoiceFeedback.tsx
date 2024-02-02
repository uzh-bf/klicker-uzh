import { faCheck, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { QuestionFeedback } from '@klicker-uzh/graphql/dist/ops'
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
        'flex flex-row gap-3 items-center text-sm border rounded bg-gray-50'
      )}
    >
      <div
        className={twMerge(
          'self-stretch px-3 w-8 py-2 text-xs bg-gray-300 flex text-gray-600 flex-col items-center justify-center',
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
