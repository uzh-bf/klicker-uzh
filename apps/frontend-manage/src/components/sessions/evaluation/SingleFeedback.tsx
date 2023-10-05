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
      <div className="w-full p-2 border border-solid rounded-md border-uzh-grey-40">
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
        <div key={response?.content} className="w-full pl-12 mt-1 text-base">
          <div className="border border-solid rounded border-uzh-grey-40 p-1.5 bg-opacity-50 bg-primary-20">
            {response?.content}
          </div>
        </div>
      ))}
    </div>
  )
}

export default SingleFeedback
