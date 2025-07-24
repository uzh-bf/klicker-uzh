import { useQuery } from '@apollo/client'
import { faClock } from '@fortawesome/free-regular-svg-icons'
import {
  faArrowUpRightFromSquare,
  faExclamationTriangle,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ActivityInfo,
  ActivityType,
  GetActivityDetailsDocument,
  GetOutdatedElementInstancesDocument,
  PublicationStatus,
} from '@klicker-uzh/graphql/dist/ops'
import { H4, Modal, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

function ActivityDetailsModal({
  activity,
  onClose,
}: {
  activity: ActivityInfo
  onClose: () => void
}) {
  const t = useTranslations()

  // fetch activity details
  const { data: activityDetails, loading } = useQuery(
    GetActivityDetailsDocument,
    { variables: { activityId: activity.id, activityType: activity.type } }
  )
  const stacks = activityDetails?.activityDetails?.stacks ?? []

  // check which instances are outdated
  const { data } = useQuery(GetOutdatedElementInstancesDocument, {
    variables: {
      instanceIds: stacks.flatMap((stack) =>
        stack.elements.map((instance) => instance.id)
      ),
    },
    skip: !activityDetails,
  })
  const outdatedInstances = useMemo(
    () =>
      [
        PublicationStatus.Draft,
        PublicationStatus.Scheduled,
        PublicationStatus.Template,
      ].includes(activity.status)
        ? (data?.getOutdatedElementInstances?.map((instance) => instance.id) ??
          [])
        : [],
    [data?.getOutdatedElementInstances]
  )

  return (
    <Modal
      open
      loading={loading}
      title={t('manage.activities.activityDetails')}
      onClose={onClose}
      className={{ content: 'w-96 min-w-96 max-w-96' }}
      data={{ cy: 'activity-details-modal' }}
      dataCloseButton={{ cy: 'close-activity-details-modal' }}
    >
      {outdatedInstances.length > 0 && (
        <UserNotification type="warning" className={{ root: 'mb-2' }}>
          {t.rich(
            activity.status === PublicationStatus.Template
              ? 'manage.activities.instanceUpdateTemplate'
              : 'manage.activities.instanceUpdateDraftScheduled',
            {
              b: (content) => <b>{content}</b>,
              ul: (content) => <ul className="list-disc pl-4">{content}</ul>,
              li: (content) => (
                <li className="mt-0.5 last:hidden">{content}</li>
              ),
            }
          )}
        </UserNotification>
      )}
      <div
        className="flex flex-col items-center gap-4 overflow-x-auto overflow-y-hidden"
        data-cy="activity-details-modal"
      >
        {stacks.map((stack, index) => (
          <div
            key={stack.id}
            className="w-full border-b border-black pb-4 last:border-r-0 last:pr-0"
          >
            <div className="mb-1 flex flex-row justify-between">
              <H4>
                {activity.type === ActivityType.LiveQuiz
                  ? t('shared.generic.blockN', {
                      number: index + 1,
                    })
                  : t('shared.generic.stackN', {
                      number: index + 1,
                    })}
              </H4>
              <div className="flex flex-row gap-3">
                {stack.timeLimit !== null ? (
                  <div className="flex flex-row items-center gap-1.5 text-orange-500">
                    <div>{`${stack.timeLimit}s`}</div>
                    <FontAwesomeIcon icon={faClock} className="w-4" />
                  </div>
                ) : null}
                {stack.numOfParticipants !== null ? (
                  <div className="flex flex-row items-center gap-1">
                    <div>{stack.numOfParticipants}</div>
                    <FontAwesomeIcon icon={faUserGroup} className="w-4" />
                  </div>
                ) : null}
              </div>
            </div>
            <div>
              {stack.elements.map((instance, instanceIx) => (
                <Link
                  href={`/instances/${instance.id}`}
                  className="text-sm hover:text-slate-700"
                  key={instance.id}
                  legacyBehavior
                  passHref
                >
                  <a
                    data-cy={`open-instance-${instance.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div
                      className={twMerge(
                        'hover:text-primary-100 flex flex-row items-center justify-between gap-1.5 border-b text-sm',
                        outdatedInstances.includes(instance.id)
                          ? 'bg-uzh-red-20'
                          : ''
                      )}
                      data-cy={`stack-${index}-instance-${instanceIx}`}
                    >
                      <div className="flex flex-row items-center gap-1.5">
                        {outdatedInstances.includes(instance.id) ? (
                          <FontAwesomeIcon
                            icon={faExclamationTriangle}
                            className="text-uzh-red-100"
                          />
                        ) : null}
                        <div>
                          {instance.name} ({t(`shared.${instance.type}.short`)})
                        </div>
                      </div>
                      <FontAwesomeIcon
                        icon={faArrowUpRightFromSquare}
                        className="h-3 w-3"
                      />
                    </div>
                  </a>
                </Link>
              ))}
            </div>
            <div className="float-right text-sm">
              {t('shared.generic.Nelements', {
                number: stack.elements?.length,
              })}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

export default ActivityDetailsModal
