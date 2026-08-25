import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ActivityType,
  ElementType,
  PublicationStatus,
} from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface EvaluationUnavailableNotificationProps {
  courseName?: string | null
  activityName?: string | null
  activityId?: string | null
  activityType?: ActivityType | null
  activityStatus?: PublicationStatus | null
  elementType?: ElementType | null
  elementName?: string | null
}

function EvaluationUnavailableNotification({
  courseName,
  activityName,
  activityId,
  activityType = ActivityType.LiveQuiz,
  activityStatus,
  elementType,
  elementName,
}: EvaluationUnavailableNotificationProps) {
  const t = useTranslations()

  const formattedElementType = elementType
    ? t(`shared.${elementType}.typeLabel`)
    : null

  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-4">
      <UserNotification
        className={{
          root: 'max-w-[80%] text-lg lg:max-w-[60%] 2xl:max-w-[50%]',
        }}
        message={t('manage.evaluation.evaluationNotYetAvailable')}
      />

      <div className="mt-6 flex flex-row gap-12 text-sm text-gray-600">
        <div className="space-y-2">
          {elementName && (
            <div>
              <span className="font-semibold">
                {t('shared.generic.element')}
              </span>
              : {elementName}
            </div>
          )}
          {formattedElementType && (
            <div>
              <span className="font-semibold">
                {t('manage.general.elementType')}
              </span>
              : {formattedElementType}
            </div>
          )}
          {activityId && (
            <div>
              <a
                href={`/activities?openActivityDetailsId=${encodeURIComponent(activityId)}&openActivityDetailsType=${activityType ?? ActivityType.LiveQuiz}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-80 hover:underline"
              >
                <FontAwesomeIcon
                  size="sm"
                  icon={faExternalLinkAlt}
                  className="mr-2"
                />
                {t('manage.evaluation.linkActivityDetails')}
              </a>
            </div>
          )}
        </div>
        <div className="space-y-2">
          {activityName && (
            <div>
              <span className="font-semibold">
                {t('shared.generic.activity')}
              </span>
              : {activityName}
            </div>
          )}
          {activityStatus && (
            <div>
              <span className="font-semibold">
                {t('manage.evaluation.activityStatus')}
              </span>
              : {t(`shared.${activityStatus}.statusLabel`)}
            </div>
          )}

          {courseName && (
            <div>
              <span className="font-semibold">
                {t('shared.generic.course')}
              </span>
              : {courseName}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EvaluationUnavailableNotification
