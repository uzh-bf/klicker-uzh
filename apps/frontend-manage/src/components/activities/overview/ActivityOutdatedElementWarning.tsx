import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { PublicationStatus } from '@klicker-uzh/graphql/dist/ops'
import { Tooltip } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function ActivityOutdatedElementWarning({
  status,
}: {
  status: PublicationStatus
}) {
  const t = useTranslations()

  return (
    <Tooltip
      delay={0}
      tooltip={t.rich(
        status === PublicationStatus.Template
          ? 'manage.activities.instanceUpdateTemplate'
          : 'manage.activities.instanceUpdateDraftScheduled',
        {
          b: (content) => <b>{content}</b>,
          ul: (content) => <ul className="list-disc pl-4">{content}</ul>,
          li: (content) => <li className="mt-0.5">{content}</li>,
        }
      )}
      className={{ tooltip: 'border-uzh-red-100 text-wrap' }}
    >
      <FontAwesomeIcon
        icon={faExclamationTriangle}
        className="text-uzh-red-100"
      />
    </Tooltip>
  )
}

export default ActivityOutdatedElementWarning
