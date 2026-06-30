import { faThumbsUp } from '@fortawesome/free-regular-svg-icons'
import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'

export type DisplayFeedback = {
  id: number
  content: string
  votes: number
  createdAt: string | Date
  isPinned: boolean
  isPublished: boolean
  isResolved: boolean
  responses?:
    | {
        id: number
        content: string
      }[]
    | null
}

interface SingleFeedbackProps {
  feedback: DisplayFeedback
}

function SingleFeedback({ feedback }: SingleFeedbackProps) {
  const t = useTranslations()

  return (
    <div key={feedback.content} className="break-inside-avoid">
      <div className="border-border w-full rounded-md border border-solid p-2">
        <div className="flex flex-row justify-between">
          <div>{feedback.content}</div>
          <div className="flex flex-row items-center text-gray-500">
            <div>{feedback.votes}</div>
            <FontAwesomeIcon icon={faThumbsUp} className="ml-1.5" />
          </div>
        </div>
        <div className="flex flex-row justify-between text-base text-gray-500">
          <div>{dayjs(feedback.createdAt).format('DD.MM.YYYY HH:mm')}</div>
          {feedback.isResolved && (
            <div className="flex flex-row items-center">
              <FontAwesomeIcon icon={faCheck} className="mr-1.5" />
              <div>{t('manage.evaluation.resolvedDuringLiveQuiz')}</div>
            </div>
          )}
        </div>
      </div>
      {feedback.responses?.map((response) => (
        <div key={response?.content} className="mt-1 w-full pl-12 text-base">
          <div className="border-border bg-primary-20 rounded border border-solid bg-opacity-50 p-1.5">
            {response?.content}
          </div>
        </div>
      ))}
    </div>
  )
}

export default SingleFeedback
