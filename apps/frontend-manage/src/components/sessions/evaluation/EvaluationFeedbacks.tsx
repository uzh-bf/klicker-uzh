import FeedbackSearchAndFilters from '@components/interaction/feedbacks/FeedbackSearchAndFilters'
import { faThumbsUp } from '@fortawesome/free-regular-svg-icons'
import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Feedback } from '@klicker-uzh/graphql/dist/ops'
import useFeedbackFilter from '@lib/hooks/useFeedbackFilter'
import dayjs from 'dayjs'

interface EvaluationFeedbacksProps {
  feedbacks: Feedback[]
}

function EvaluationFeedbacks({ feedbacks }: EvaluationFeedbacksProps) {
  const { sortedFeedbacks, filterProps } = useFeedbackFilter(feedbacks, {
    withSearch: true,
  })

  return (
    <div className="flex flex-col gap-3">
      <FeedbackSearchAndFilters
        className="text-base"
        disabled={sortedFeedbacks?.length === 0}
        {...filterProps}
      />
      {sortedFeedbacks?.map((feedback) => (
        <div key={feedback.content}>
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
                  <div>Während der Session gelöst</div>
                </div>
              )}
            </div>
          </div>
          {feedback.responses?.map((response) => (
            <div
              key={response?.content}
              className="w-full pl-12 mt-1 text-base"
            >
              <div className="border border-solid rounded border-uzh-grey-40 p-1.5 bg-opacity-50 bg-uzh-blue-20">
                {response?.content}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default EvaluationFeedbacks
