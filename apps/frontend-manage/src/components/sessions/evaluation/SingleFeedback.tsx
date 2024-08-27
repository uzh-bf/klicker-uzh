import { faThumbsUp } from '@fortawesome/free-regular-svg-icons'
import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Feedback } from '@klicker-uzh/graphql/dist/ops'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'

interface SingleFeedbackProps {
  feedback: Feedback
}

function SingleFeedback({ feedback }: SingleFeedbackProps) {
  const t = useTranslations()

  return (
    <div key={feedback.content} className="break-inside-avoid">
      <div className="border-uzh-grey-40 w-full rounded-md border border-solid p-2">
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
              <div>{t('manage.evaluation.resolvedDuringSession')}</div>
            </div>
          )}
        </div>
      </div>
      {feedback.responses?.map((response) => (
        <div key={response?.content} className="mt-1 w-full pl-12 text-base">
          <div className="border-uzh-grey-40 bg-primary-20 rounded border border-solid bg-opacity-50 p-1.5">
            {response?.content}
          </div>
        </div>
      ))}
    </div>
  )
}

export default SingleFeedback
