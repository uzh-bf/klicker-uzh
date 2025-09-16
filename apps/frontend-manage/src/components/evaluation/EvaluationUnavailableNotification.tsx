import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { PublicationStatus } from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function EvaluationUnavailableNotification({
  courseName,
  activityName,
  activityId,
  activityStatus,
  elementType,
  elementName,
}: {
  courseName?: string | null
  activityName?: string | null
  activityId?: string | null
  activityStatus?: PublicationStatus | null
  elementType?: string | null
  elementName?: string | null
}) {
  const t = useTranslations()

  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <UserNotification
        className={{
          root: 'max-w-[80%] text-lg lg:max-w-[60%] 2xl:max-w-[50%]',
        }}
        message={t('manage.evaluation.evaluationNotYetAvailable')}
      />

      <div className="mt-4 flex flex-row gap-8 text-xs text-gray-500">
        <div className="space-y-2">
          {elementName && (
            <div>
              <span className="font-semibold">
                {t('manage.evaluation.elementName')}
              </span>
              : {elementName}
            </div>
          )}
          {elementType && (
            <div>
              <span className="font-semibold">
                {t('manage.evaluation.elementType')}
              </span>
              : {elementType}
            </div>
          )}
          {activityId && (
            <a
              href={`https://manage.klicker.com/activities?openActivityDetailsId=${activityId}&openActivityDetailsType=LIVE_QUIZ`}
              target="_blank"
              rel="noreferrer"
            >
              <FontAwesomeIcon
                size="sm"
                icon={faExternalLinkAlt}
                className="mr-2"
              />
              {t('manage.evaluation.linkActivityDetails')}
            </a>
          )}
        </div>
        <div className="space-y-2">
          {activityName && (
            <div>
              <span className="font-semibold">
                {t('manage.evaluation.activityName')}
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
                {t('manage.evaluation.courseName')}
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
