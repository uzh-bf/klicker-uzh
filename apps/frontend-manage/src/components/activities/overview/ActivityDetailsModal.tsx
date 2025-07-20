import { faClock } from '@fortawesome/free-regular-svg-icons'
import {
  faArrowUpRightFromSquare,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ActivityInfo, ActivityType } from '@klicker-uzh/graphql/dist/ops'
import { H4, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

function ActivityDetailsModal({
  activity,
  onClose,
}: {
  activity: ActivityInfo
  onClose: () => void
}) {
  const t = useTranslations()

  return (
    <Modal
      open
      title={t('manage.activities.activityDetails')}
      onClose={onClose}
      className={{ content: 'w-96 min-w-96 max-w-96' }}
      data={{ cy: 'activity-details-modal' }}
      dataCloseButton={{ cy: 'close-activity-details-modal' }}
    >
      <div
        className="flex flex-col items-center gap-4 overflow-x-auto overflow-y-hidden"
        data-cy="activity-details-modal"
      >
        {activity.stacks.map((stack, index) => (
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
                      className="hover:text-primary-100 flex flex-row items-center justify-between gap-1.5 border-b text-sm"
                      data-cy={`stack-${index}-instance-${instanceIx}`}
                    >
                      <div>
                        {instance.name} ({t(`shared.${instance.type}.short`)})
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
