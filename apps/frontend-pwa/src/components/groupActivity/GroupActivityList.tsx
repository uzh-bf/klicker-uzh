import {
  faCheck,
  faHourglassEnd,
  faHourglassStart,
  faPlay,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { H3 } from '@uzh-bf/design-system'

import { faClock } from '@fortawesome/free-regular-svg-icons'
import {
  GroupActivity,
  GroupActivityInstance,
  GroupActivityStatus,
} from '@klicker-uzh/graphql/dist/ops'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import ActivityInstanceLink from './ActivityInstanceLink'

interface GroupActivityListProps {
  groupId: string
  groupActivities?: Omit<GroupActivity, 'name'>[] | null
  groupActivityInstances: Record<string, GroupActivityInstance>
}

function GroupActivityList({
  groupId,
  groupActivities,
  groupActivityInstances,
}: GroupActivityListProps) {
  const t = useTranslations()

  return (
    <div className="mt-4">
      <H3>{t('shared.generic.groupActivities')}</H3>
      <div className="flex flex-col gap-1 border-t pt-2">
        {groupActivities?.map((activity) => {
          const existingSubmission =
            groupActivityInstances[activity.id]?.decisionsSubmittedAt
          const existingResults = groupActivityInstances[activity.id]?.results

          return (
            <div
              key={activity.id}
              className="flex flex-col justify-between gap-2 rounded-md border border-solid p-1.5 md:flex-row md:gap-0"
              data-cy={`group-activity-${activity.displayName}`}
            >
              <div>
                <div>{activity.displayName}</div>
                <div className="flex flex-row gap-5 text-sm">
                  <div className="flex flex-row items-center gap-2">
                    <FontAwesomeIcon icon={faHourglassStart} />
                    <div>
                      {t('pwa.groupActivity.startAt', {
                        time: dayjs(activity.scheduledStartAt).format(
                          'DD.MM.YYYY HH:mm'
                        ),
                      })}
                    </div>
                  </div>
                  <div className="flex flex-row items-center gap-1">
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

              {activity.status === GroupActivityStatus.Published && (
                <div className="flex h-max flex-row items-center gap-1.5">
                  <ActivityInstanceLink
                    groupId={groupId}
                    activity={activity}
                    label={t('pwa.groupActivity.openGroupActivity')}
                    data={{
                      cy: `open-group-activity-${activity.displayName}`,
                    }}
                  />
                  <div className="flex h-max w-max flex-row items-center gap-2 rounded bg-green-300 px-2 py-0.5 text-sm">
                    <FontAwesomeIcon icon={faPlay} />
                    <div>
                      {!groupActivityInstances[activity.id]?.id
                        ? t('pwa.groupActivity.available')
                        : existingSubmission
                          ? t('pwa.groupActivity.submitted')
                          : t('pwa.groupActivity.started')}
                    </div>
                  </div>
                </div>
              )}

              {activity.status === GroupActivityStatus.Ended && (
                <div className="flex h-max flex-row items-center gap-1.5">
                  <ActivityInstanceLink
                    groupId={groupId}
                    activity={activity}
                    label={
                      existingSubmission
                        ? t('pwa.groupActivity.openGroupActivitySubmission')
                        : t('pwa.groupActivity.openGroupActivity')
                    }
                    data={{
                      cy: existingSubmission
                        ? `open-submission-${activity.displayName}`
                        : `open-group-activity-${activity.displayName}`,
                    }}
                  />
                  <div
                    className={twMerge(
                      'flex h-max w-max flex-row items-center gap-2 rounded bg-slate-300 px-2 py-0.5 text-sm',
                      existingSubmission && 'bg-green-300'
                    )}
                  >
                    {existingSubmission ? (
                      <>
                        <FontAwesomeIcon icon={faClock} />
                        <div>{t('pwa.groupActivity.submitted')}</div>
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faXmark} />
                        <div>{t('pwa.groupActivity.past')}</div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {activity.status === GroupActivityStatus.Graded &&
                (existingResults ? (
                  <div className="flex h-max flex-row items-center gap-1.5">
                    <ActivityInstanceLink
                      groupId={groupId}
                      activity={activity}
                      label={t('pwa.groupActivity.openActivityFeedback')}
                      data={{ cy: `open-feedback-${activity.displayName}` }}
                    />
                    {existingResults.passed ? (
                      <div
                        className="flex h-max w-max flex-row items-center gap-2 rounded bg-green-300 px-2 py-0.5 text-sm"
                        data-cy="group-activity-passed-tag"
                      >
                        <FontAwesomeIcon icon={faCheck} />
                        <div>{t('shared.generic.passed')}</div>
                      </div>
                    ) : (
                      <div
                        className="flex h-max w-max flex-row items-center gap-2 rounded bg-red-400 px-2 py-0.5 text-sm"
                        data-cy="group-activity-failed-tag"
                      >
                        <FontAwesomeIcon icon={faXmark} />
                        <div>{t('shared.generic.failed')}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex h-max flex-row items-center gap-1.5">
                    <ActivityInstanceLink
                      groupId={groupId}
                      activity={activity}
                      label={t('pwa.groupActivity.openGroupActivity')}
                      data={{
                        cy: `open-group-activity-${activity.displayName}`,
                      }}
                    />
                    <div className="flex h-max w-max flex-row items-center gap-2 rounded bg-slate-300 px-2 py-0.5 text-sm">
                      <FontAwesomeIcon icon={faXmark} />
                      <div>{t('pwa.groupActivity.past')}</div>
                    </div>
                  </div>
                ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default GroupActivityList
