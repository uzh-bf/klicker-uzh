import {
  faClock,
  faHandPointer,
  faTrashCan,
} from '@fortawesome/free-regular-svg-icons'
import {
  faCheck,
  faHourglassEnd,
  faHourglassStart,
  faPencil,
  faPlay,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GroupActivity,
  GroupActivityStatus,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Dropdown } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { WizardMode } from '../sessions/creation/SessionCreation'
import StatusTag from './StatusTag'
import PublishGroupActivityButton from './actions/PublishGroupActivityButton'
import DeletionModal from './modals/DeletionModal'

interface GroupActivityElementProps {
  groupActivity: Partial<GroupActivity> & Pick<GroupActivity, 'id' | 'name'>
}

function GroupActivityElement({ groupActivity }: GroupActivityElementProps) {
  const t = useTranslations()
  const router = useRouter()

  const [deletionModal, setDeletionModal] = useState(false)
  const isFuture = dayjs(groupActivity.scheduledStartAt).isAfter(dayjs())
  const isPast = dayjs(groupActivity.scheduledEndAt).isBefore(dayjs())

  // TODO: unpublish method
  const unpublishGroupActivity = async () => {}
  // TODO: delete method
  const deleteGroupActivity = async () => {}

  return (
    <div
      className="w-full p-2 border border-solid rounded border-uzh-grey-80"
      data-cy={`groupActivity-${groupActivity.name}`}
    >
      <div className="flex flex-row items-center justify-between">
        <Ellipsis maxLength={50} className={{ markdown: 'font-bold' }}>
          {groupActivity.name}
        </Ellipsis>
        <div className="flex flex-row items-center gap-3 text-sm">
          {groupActivity.status === GroupActivityStatus.Draft && (
            <>
              <PublishGroupActivityButton groupActivity={groupActivity} />
              <Dropdown
                data={{ cy: `groupActivity-actions-${groupActivity.name}` }}
                className={{
                  item: 'p-1 hover:bg-gray-200',
                  viewport: 'bg-white',
                }}
                trigger={t('manage.course.otherActions')}
                items={[
                  {
                    label: (
                      <div className="flex flex-row text-primary items-center gap-2 cursor-pointer">
                        <FontAwesomeIcon icon={faPencil} />
                        <div>{t('manage.course.editGroupActivity')}</div>
                      </div>
                    ),
                    onClick: () =>
                      router.push({
                        pathname: '/',
                        query: {
                          sessionId: groupActivity.id,
                          editMode: WizardMode.GroupActivity,
                        },
                      }),
                    data: { cy: `edit-groupActivity-${groupActivity.name}` },
                  },
                  {
                    label: (
                      <div className="flex flex-row text-red-600 items-center gap-1 cursor-pointer">
                        <FontAwesomeIcon
                          icon={faTrashCan}
                          className="w-[1.1rem]"
                        />
                        <div>{t('manage.course.deleteGroupActivity')}</div>
                      </div>
                    ),
                    onClick: () => setDeletionModal(true),
                    data: { cy: `delete-groupActivity-${groupActivity.name}` },
                  },
                ]}
                triggerIcon={faHandPointer}
              />
              <StatusTag
                color="bg-gray-200"
                status={t('shared.generic.draft')}
                icon={faPencil}
              />
            </>
          )}

          {groupActivity.status === GroupActivityStatus.Published && (
            <>
              {/* // TODO */}
              {isPast && <div>FINISHED - GRADING LINK</div>}
              {/* // TODO */}
              {isFuture && <div>SCHEDULED - UNPUBLISHING</div>}

              <StatusTag
                color="bg-green-300"
                status={
                  isFuture
                    ? t('shared.generic.scheduled')
                    : isPast
                    ? t('shared.generic.completed')
                    : t('shared.generic.running')
                }
                icon={isFuture ? faClock : isPast ? faCheck : faPlay}
              />
            </>
          )}
        </div>
      </div>

      <div className="mb-1 text-sm italic">
        {t('pwa.microLearning.numOfQuestionSets', {
          number: groupActivity.numOfQuestions,
        })}
      </div>
      <div className="flex flex-row gap-4 text-sm">
        <div className="flex flex-row items-center gap-2">
          <FontAwesomeIcon icon={faHourglassStart} />
          <div>
            {t('manage.course.startAt', {
              time: dayjs(groupActivity.scheduledStartAt)
                .local()
                .format('DD.MM.YYYY, HH:mm'),
            })}
          </div>
        </div>
        <div className="flex flex-row items-center gap-2">
          <FontAwesomeIcon icon={faHourglassEnd} />
          <div>
            {t('manage.course.endAt', {
              time: dayjs(groupActivity.scheduledEndAt)
                .local()
                .format('DD.MM.YYYY, HH:mm'),
            })}
          </div>
        </div>
      </div>
      <DeletionModal
        title={t('manage.course.deleteGroupActivity')}
        description={t('manage.course.confirmDeletionGroupActivity')}
        elementName={groupActivity.name}
        message={t('manage.course.hintDeletionGroupActivity')}
        deleteElement={deleteGroupActivity}
        open={deletionModal}
        setOpen={setDeletionModal}
        primaryData={{ cy: 'confirm-delete-groupActivity' }}
        secondaryData={{ cy: 'cancel-delete-groupActivity' }}
      />
    </div>
  )
}

export default GroupActivityElement
