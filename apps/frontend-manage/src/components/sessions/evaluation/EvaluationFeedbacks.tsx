import { Feedback } from '@klicker-uzh/graphql/dist/ops'
import useFeedbackFilter from '@lib/hooks/useFeedbackFilter'
import { useTranslations } from 'next-intl'
import FeedbackSearchAndFilters from '../../interaction/feedbacks/FeedbackSearchAndFilters'
import FeedbacksPrintView from './FeedbacksPrintView'
import SingleFeedback from './SingleFeedback'

interface EvaluationFeedbacksProps {
  feedbacks: Feedback[]
  sessionName: string
}

function EvaluationFeedbacks({
  feedbacks,
  sessionName,
}: EvaluationFeedbacksProps) {
  const t = useTranslations()
  const { sortedFeedbacks, filterProps } = useFeedbackFilter(feedbacks, {
    withSearch: true,
  })

  return (
    <>
      <FeedbacksPrintView
        feedbacks={sortedFeedbacks}
        sessionName={sessionName}
      />
      <div className="space-y-3 print:hidden">
        <FeedbackSearchAndFilters
          className="text-base"
          disabled={{
            search: feedbacks?.length === 0,
            filters: feedbacks?.length === 0,
            print: feedbacks?.length === 0,
            sorting: feedbacks?.length === 0,
          }}
          {...filterProps}
        />
        {sortedFeedbacks?.length === 0 && (
          <div>{t('manage.evaluation.noFeedbacksMatchFilter')}</div>
        )}
        {sortedFeedbacks?.map((feedback) => (
          <SingleFeedback key={feedback.id} feedback={feedback} />
        ))}
      </div>
    </>
  )
}

export default EvaluationFeedbacks
