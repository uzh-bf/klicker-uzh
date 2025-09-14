import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Tooltip } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function ActivityBatchOperationsInfo() {
  const t = useTranslations()

  return (
    <Tooltip
      delay={0}
      tooltip={t.rich('manage.activities.batchOperationsInformation', {
        b: (content) => <b>{content}</b>,
        ul: (content) => <ul className="list-disc pl-4">{content}</ul>,
        li: (content) => <li className="mt-0.5">{content}</li>,
      })}
      className={{ tooltip: 'border-primary-100 text-wrap' }}
    >
      <FontAwesomeIcon
        size="lg"
        icon={faQuestionCircle}
        className="text-uzh-blue-60"
        data-cy="activity-batch-operations-info"
      />
    </Tooltip>
  )
}

export default ActivityBatchOperationsInfo
