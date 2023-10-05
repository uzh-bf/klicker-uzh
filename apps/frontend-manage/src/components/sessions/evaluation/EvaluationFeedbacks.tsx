import { Feedback } from '@klicker-uzh/graphql/dist/ops'
import useFeedbackFilter from '@lib/hooks/useFeedbackFilter'
import { H2 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import FeedbackSearchAndFilters from '../../interaction/feedbacks/FeedbackSearchAndFilters'
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
      {sortedFeedbacks && sortedFeedbacks.length > 0 && (
        <div className="hidden print:block space-y-3">
          <H2 className={{ root: 'border-b-2 border-solid border-gray-400' }}>
            {t('manage.cockpit.printTitle', { name: sessionName })}
          </H2>
          {sortedFeedbacks.map((feedback) => (
            <SingleFeedback key={feedback.id} feedback={feedback} />
          ))}
        </div>
      )}
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
