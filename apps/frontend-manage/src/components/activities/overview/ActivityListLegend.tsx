import {
  faCheckCircle,
  faClock,
  faPenToSquare,
  faQuestionCircle,
} from '@fortawesome/free-regular-svg-icons'
import { faFilePen, faPlay, faStamp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  H3,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import {
  ActivityType,
  PublicationStatus,
} from '../../../lib/constants/activityEnums'

function ActivityListLegend({ type }: { type: ActivityType }) {
  const t = useTranslations()

  return (
    <Popover>
      <PopoverTrigger
        className="hover:bg-accent text-primary-100 mb-1 flex flex-row items-center gap-2 rounded px-2 py-1 text-sm"
        data-cy="activity-list-legend"
      >
        <FontAwesomeIcon icon={faQuestionCircle} />
        <div>{t('shared.generic.legend')}</div>
      </PopoverTrigger>
      <PopoverContent className="w-max">
        <div>
          <H3>{t('manage.activities.actionsLegend')}</H3>
          <div className="mt-2 flex flex-col gap-3 text-sm">
            <div className="flex h-4 flex-row items-center gap-2">
              <FontAwesomeIcon icon={faPenToSquare} className="h-4 w-4" />
              <div>{t(`shared.${PublicationStatus.Draft}.statusLabel`)}</div>
            </div>
            <div className="flex h-4 flex-row items-center gap-2 text-orange-600">
              <FontAwesomeIcon icon={faClock} className="h-4 w-4" />
              <div>
                {t(`shared.${PublicationStatus.Scheduled}.statusLabel`)}
              </div>
            </div>
            <div className="flex h-4 flex-row items-center gap-2 text-green-700">
              <FontAwesomeIcon icon={faPlay} className="h-4 w-4" />
              <div>
                {type === ActivityType.LiveQuiz
                  ? t(`shared.${PublicationStatus.Published}.statusLabel2`)
                  : t(`shared.${PublicationStatus.Published}.statusLabel1`)}
              </div>
            </div>
            {type !== ActivityType.PracticeQuiz && (
              <div className="flex h-4 flex-row items-center gap-2 text-gray-500">
                <FontAwesomeIcon icon={faCheckCircle} className="h-4 w-4" />
                <div>
                  {type === ActivityType.GroupActivity
                    ? t(`shared.${PublicationStatus.Ended}.statusLabel2`)
                    : t(`shared.${PublicationStatus.Ended}.statusLabel1`)}
                </div>
              </div>
            )}
            {type === ActivityType.GroupActivity && (
              <div className="flex h-4 flex-row items-center gap-2 text-gray-500">
                <FontAwesomeIcon icon={faStamp} className="h-4 w-4" />
                <div>{t(`shared.${PublicationStatus.Graded}.statusLabel`)}</div>
              </div>
            )}
            {type === ActivityType.LiveQuiz && (
              <div className="flex h-4 flex-row items-center gap-2 text-red-700">
                <FontAwesomeIcon icon={faFilePen} className="h-4 w-4" />
                <div>
                  {t(`shared.${PublicationStatus.Template}.statusLabel`)}
                </div>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default ActivityListLegend
