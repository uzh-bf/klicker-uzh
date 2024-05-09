import {
  faCheck,
  faHourglassEnd,
  faHourglassStart,
  faPlay,
  faUserGroup,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { H3 } from '@uzh-bf/design-system'

import { faClock } from '@fortawesome/free-regular-svg-icons'
import {
  GroupActivity,
  GroupActivityInstance,
} from '@klicker-uzh/graphql/dist/ops'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import ActivityInstanceLink from './ActivityInstanceLink'

interface GroupActivityListProps {
  groupId: string
  groupActivities?: GroupActivity[] | null
  groupActivityInstances: Record<string, GroupActivityInstance>
}

function GroupActivityList({
  groupId,
  groupActivities,
  groupActivityInstances,
}: GroupActivityListProps) {
  const t = useTranslations()

  return (
    <div className="mt-8">
      <H3>{t('shared.generic.groupActivities')}</H3>
      <div className="flex flex-col pt-2 border-t gap-1">
        {groupActivities?.map((activity, activityIx) => (
          <div
            key={activity.id}
            className="flex flex-col md:flex-row border border-solid rounded-md p-1.5 justify-between gap-2 md:gap-0"
          >
            <div>
              <div>{activity.displayName}</div>
              <div className="flex flex-row text-sm gap-5">
                <div className="flex flex-row gap-2 items-center">
                  <FontAwesomeIcon icon={faHourglassStart} />
                  <div>
                    {t('pwa.groupActivity.startAt', {
                      time: dayjs(activity.scheduledStartAt).format(
                        'DD.MM.YYYY HH:mm'
                      ),
                    })}
                  </div>
                </div>
                <div className="flex flex-row gap-1 items-center">
                  <FontAwesomeIcon icon={faHourglassEnd} />
                  <div>
                    {t('pwa.groupActivity.endAt', {
                      time: dayjs(activity.scheduledEndAt).format(
                        'DD.MM.YYYY HH:mm'
                      ),
                    })}
                  </div>
                </div>
              </div>
            </div>

            {dayjs().isAfter(activity.scheduledStartAt) &&
              dayjs().isBefore(activity.scheduledEndAt) &&
              !groupActivityInstances[activity.id]?.id && (
                <div className="flex flex-row gap-1.5 h-max items-center">
                  <ActivityInstanceLink
                    groupId={groupId}
                    activity={activity}
                    label={t('pwa.groupActivity.openGroupActivity')}
                    ix={activityIx}
                  />
                  <div className="flex flex-row items-center gap-2 py-0.5 bg-green-300 rounded text-sm px-2 h-max">
                    <FontAwesomeIcon icon={faPlay} />
                    <div>{t('pwa.groupActivity.available')}</div>
                  </div>
                </div>
              )}

            {dayjs().isAfter(activity.scheduledStartAt) &&
              dayjs().isBefore(activity.scheduledEndAt) &&
              groupActivityInstances[activity.id]?.id &&
              !groupActivityInstances[activity.id]?.decisionsSubmittedAt && (
                <div className="flex flex-row gap-1.5 h-max items-center">
                  <ActivityInstanceLink
                    groupId={groupId}
                    activity={activity}
                    label={t('pwa.groupActivity.openGroupActivity')}
                    ix={activityIx}
                  />
                  <div className="flex flex-row items-center gap-2 py-0.5 bg-green-300 rounded text-sm px-2 h-max">
                    <FontAwesomeIcon icon={faUserGroup} />
                    <div>{t('pwa.groupActivity.started')}</div>
                  </div>
                </div>
              )}

            {dayjs().isAfter(activity.scheduledStartAt) &&
              dayjs().isBefore(activity.scheduledEndAt) &&
              groupActivityInstances[activity.id]?.id &&
              groupActivityInstances[activity.id]?.decisionsSubmittedAt && (
                <div className="flex flex-row gap-1.5 h-max items-center">
                  <ActivityInstanceLink
                    groupId={groupId}
                    activity={activity}
                    label={t('pwa.groupActivity.openGroupActivity')}
                    ix={activityIx}
                  />
                  <div className="flex flex-row items-center gap-2 py-0.5 bg-green-300 rounded text-sm px-2 h-max">
                    <FontAwesomeIcon icon={faClock} />
                    <div>{t('pwa.groupActivity.submitted')}</div>
                  </div>
                </div>
              )}

            {dayjs().isAfter(activity.scheduledEndAt) &&
              groupActivityInstances[activity.id]?.id &&
              !groupActivityInstances[activity.id]?.decisionsSubmittedAt && (
                <div className="flex flex-row gap-1.5 h-max items-center">
                  <div className="flex flex-row items-center gap-2 py-0.5 bg-slate-300 rounded text-sm px-2 h-max">
                    <FontAwesomeIcon icon={faXmark} />
                    <div>{t('pwa.groupActivity.past')}</div>
                  </div>
                </div>
              )}

            {dayjs().isAfter(activity.scheduledEndAt) &&
              groupActivityInstances[activity.id]?.id &&
              groupActivityInstances[activity.id]?.decisionsSubmittedAt &&
              !groupActivityInstances[activity.id]?.results && (
                <div className="flex flex-row items-center gap-2 py-0.5 bg-green-300 rounded text-sm px-2 h-max">
                  <FontAwesomeIcon icon={faClock} />
                  <div>{t('pwa.groupActivity.submitted')}</div>
                </div>
              )}

            {dayjs().isAfter(activity.scheduledEndAt) &&
              groupActivityInstances[activity.id]?.id &&
              groupActivityInstances[activity.id]?.results && (
                <div className="flex flex-row gap-1.5 h-max items-center">
                  <ActivityInstanceLink
                    groupId={groupId}
                    activity={activity}
                    label={t('pwa.groupActivity.openActivityFeedback')}
                    ix={activityIx}
                  />
                  {groupActivityInstances[activity.id]?.results.passed ? (
                    <div className="flex flex-row items-center gap-2 py-0.5 bg-green-300 rounded text-sm px-2 h-max">
                      <FontAwesomeIcon icon={faCheck} />
                      <div>{t('pwa.groupActivity.passed')}</div>
                    </div>
                  ) : (
                    <div className="flex flex-row items-center gap-2 py-0.5 bg-red-400 rounded text-sm px-2 h-max">
                      <FontAwesomeIcon icon={faXmark} />
                      <div>{t('pwa.groupActivity.failed')}</div>
                    </div>
                  )}
                </div>
              )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default GroupActivityList
