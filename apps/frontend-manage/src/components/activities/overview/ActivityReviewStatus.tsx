import { faCheckDouble, faInfoCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ReviewStatus } from '@klicker-uzh/graphql/dist/ops'
import { Tooltip } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function ActivityReviewStatus({
  reviewStatus,
}: {
  reviewStatus: ReviewStatus
}) {
  const t = useTranslations()

  return (
    <>
      {reviewStatus === ReviewStatus.Reviewed ? (
        <div className="mr-3 flex flex-row items-center gap-1.5 text-sm text-green-700">
          <FontAwesomeIcon icon={faCheckDouble} />
          <span>{t('shared.generic.reviewStatusREVIEWED')}</span>
        </div>
      ) : null}
      {reviewStatus === ReviewStatus.ModifiedAfterReview ? (
        <Tooltip tooltip={t('shared.generic.modifiedAfterReviewInformation')}>
          <div className="text-uzh-red-100 mr-3 flex flex-row items-center gap-1.5 text-sm">
            <FontAwesomeIcon icon={faInfoCircle} />
            <span>{t('shared.generic.reviewStatusMODIFIED_AFTER_REVIEW')}</span>
          </div>
        </Tooltip>
      ) : null}
    </>
  )
}

export default ActivityReviewStatus
