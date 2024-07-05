import { Feedback } from '@klicker-uzh/graphql/dist/ops'
import { H2 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import SingleFeedback from './SingleFeedback'

interface FeedbacksPrintViewProps {
  feedbacks?: Feedback[]
  sessionName: string
}

function FeedbacksPrintView({
  feedbacks,
  sessionName,
}: FeedbacksPrintViewProps) {
  const t = useTranslations()

  if (typeof feedbacks === 'undefined' || feedbacks.length === 0) return <></>

  return (
    <div className="hidden print:block space-y-3">
      <H2 className={{ root: 'border-b-2 border-solid border-gray-400' }}>
        {t('manage.cockpit.printTitle', { name: sessionName })}
      </H2>
      {feedbacks.map((feedback) => (
        <SingleFeedback key={feedback.id} feedback={feedback} />
      ))}
    </div>
  )
}

export default FeedbacksPrintView
