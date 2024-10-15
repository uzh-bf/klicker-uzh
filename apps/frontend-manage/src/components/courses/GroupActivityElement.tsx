import { faHandPointer, faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  faArrowsRotate,
  faCheck,
  faClock,
  faFlagCheckered,
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
import React, { useState } from 'react'
import { WizardMode } from '../sessions/creation/ElementCreation'
import StatusTag from './StatusTag'
import PublishGroupActivityButton from './actions/PublishGroupActivityButton'
import GroupActivityExtensionButton from './groupActivity/GroupActivityExtensionButton'
import GroupActivityGradingLink from './groupActivity/GroupActivityGradingLink'
import GroupActivityUnpublishButton from './groupActivity/GroupActivityUnpublishButton'
import GroupActivityDeletionModal from './modals/GroupActivityDeletionModal'
import GroupActivityEndingModal from './modals/GroupActivityEndingModal'
import GroupActivityStartingModal from './modals/GroupActivityStartingModal'

interface GroupActivityElementProps {
  groupActivity: Partial<GroupActivity> & Pick<GroupActivity, 'id' | 'name'>
  groupDeadlineDate: Date
  numOfParticipantGroups: number
  courseId: string
}

function GroupActivityElement({
  groupActivity,
  groupDeadlineDate,
  numOfParticipantGroups,
  courseId,
}: GroupActivityElementProps) {
  const t = useTranslations()
  const router = useRouter()

  const [deletionModal, setDeletionModal] = useState(false)
  const [endingModal, setEndingModal] = useState(false)
  const [startingModal, setStartingModal] = useState(false)

  const statusMap: Record<GroupActivityStatus, React.ReactElement> = {
    [GroupActivityStatus.Draft]: (
      <StatusTag
        color="bg-gray-200"
        status={t('shared.generic.draft')}
        icon={faPencil}
      />
    ),
    [GroupActivityStatus.Scheduled]: (
      <StatusTag
        color="bg-orange-200"
        status={t('shared.generic.scheduled')}
        icon={faClock}
      />
    ),
    [GroupActivityStatus.Published]: (
      <StatusTag
        color="bg-green-300"
        status={t('shared.generic.running')}
        icon={faPlay}
      />
    ),
    [GroupActivityStatus.Ended]: (
      <StatusTag
        color={
          groupActivity.status === GroupActivityStatus.Graded
            ? 'bg-green-300'
            : 'bg-orange-300'
        }
        status={
          groupActivity.status === GroupActivityStatus.Graded
            ? t('shared.generic.completed')
            : t('shared.generic.grading')
        }
        icon={
          groupActivity.status === GroupActivityStatus.Graded
            ? faCheck
            : faArrowsRotate
        }
      />
    ),

    [GroupActivityStatus.Graded]: (
      <StatusTag
        color={
          groupActivity.status === GroupActivityStatus.Graded
            ? 'bg-green-300'
            : 'bg-orange-300'
        }
        status={
          groupActivity.status === GroupActivityStatus.Graded
            ? t('shared.generic.completed')
            : t('shared.generic.grading')
        }
        icon={
          groupActivity.status === GroupActivityStatus.Graded
            ? faCheck
            : faArrowsRotate
        }
      />
    ),
  }

  const DeletionItem = {
    label: (
      <div className="flex cursor-pointer flex-row items-center gap-1 text-red-600">
        <FontAwesomeIcon icon={faTrashCan} className="w-[1.2rem]" />
        <div>{t('manage.course.deleteGroupActivity')}</div>
      </div>
    ),
    onClick: () => setDeletionModal(true),
    data: {
      cy: `delete-groupActivity-${groupActivity.name}`,
    },
  }

  const DeletionDropdown = (
    <Dropdown
      data={{ cy: `groupActivity-actions-${groupActivity.name}` }}
      className={{
        item: 'p-1 hover:bg-gray-200',
        viewport: 'bg-white',
      }}
      trigger={t('manage.course.otherActions')}
      items={[DeletionItem]}
      triggerIcon={faHandPointer}
    />
  )

  return (
    <div
      className="border-uzh-grey-80 flex w-full flex-row justify-between rounded border border-solid p-2"
      data-cy={`groupActivity-${groupActivity.name}`}
    >
      <div className="flex-1">
        <Ellipsis maxLength={50} className={{ markdown: 'font-bold' }}>
          {groupActivity.name}
        </Ellipsis>

        <div className="mb-1 text-sm italic">
          {t('pwa.microLearning.numOfQuestionSets', {
            number: groupActivity.numOfQuestions,
          })}
        </div>
        <div className="flex flex-row gap-4 text-sm">
          <div className="flex flex-row items-center gap-1">
            <FontAwesomeIcon icon={faHourglassStart} className="w-[1.2rem]" />
            <div>
              {t('manage.course.startAt', {
                time: dayjs(groupActivity.scheduledStartAt)
                  .local()
                  .format('DD.MM.YYYY, HH:mm'),
              })}
            </div>
          </div>
          <div className="flex flex-row items-center gap-1">
            <FontAwesomeIcon icon={faHourglassEnd} className="w-[1.2rem]" />
            <div>
              {t('manage.course.endAt', {
                time: dayjs(groupActivity.scheduledEndAt)
                  .local()
                  .format('DD.MM.YYYY, HH:mm'),
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end justify-between gap-4">
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
                      <div className="text-primary-100 flex cursor-pointer flex-row items-center gap-1">
                        <FontAwesomeIcon
                          icon={faPencil}
                          className="w-[1.2rem]"
                        />
                        <div>{t('manage.course.editGroupActivity')}</div>
                      </div>
                    ),
                    onClick: () =>
                      router.push({
                        pathname: '/',
                        query: {
                          elementId: groupActivity.id,
                          editMode: WizardMode.GroupActivity,
                        },
                      }),
                    data: { cy: `edit-groupActivity-${groupActivity.name}` },
                  },
                  DeletionItem,
                ]}
                triggerIcon={faHandPointer}
              />
            </>
          )}

          {groupActivity.status === GroupActivityStatus.Scheduled && (
            <>
              <GroupActivityUnpublishButton
                activityId={groupActivity.id}
                activityName={groupActivity.name}
                courseId={courseId}
              />
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
                      <div className="text-primary-100 flex cursor-pointer flex-row items-center gap-1">
                        <FontAwesomeIcon icon={faPlay} className="w-[1.2rem]" />
                        <div>{t('manage.course.startGroupActivityNow')}</div>
                      </div>
                    ),
                    onClick: () => setStartingModal(true),
                    data: {
                      cy: `start-group-activity-${groupActivity.name}-now`,
                    },
                  },
                  DeletionItem,
                ]}
                triggerIcon={faHandPointer}
              />
            </>
          )}

          {groupActivity.status === GroupActivityStatus.Published && (
            <>
              <GroupActivityExtensionButton
                activityId={groupActivity.id}
                activityName={groupActivity.name}
                scheduledEndAt={groupActivity.scheduledEndAt}
                courseId={courseId}
              />
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
                      <div className="text-primary-100 flex cursor-pointer flex-row items-center gap-1">
                        <FontAwesomeIcon
                          icon={faFlagCheckered}
                          className="w-[1.2rem]"
                        />
                        <div>{t('manage.course.endGroupActivity')}</div>
                      </div>
                    ),
                    onClick: () => setEndingModal(true),
                    data: { cy: `end-group-activity-${groupActivity.name}` },
                  },
                  DeletionItem,
                ]}
                triggerIcon={faHandPointer}
              />
            </>
          )}

          {groupActivity.status === GroupActivityStatus.Ended && (
            <>
              <GroupActivityGradingLink
                activityId={groupActivity.id}
                activityName={groupActivity.name}
              />
              {DeletionDropdown}
            </>
          )}

          {groupActivity.status === GroupActivityStatus.Graded && (
            <>
              <GroupActivityGradingLink
                activityId={groupActivity.id}
                activityName={groupActivity.name}
              />
              {DeletionDropdown}
            </>
          )}
        </div>

        <div>
          {statusMap[groupActivity.status ?? GroupActivityStatus.Draft]}
        </div>
      </div>
      <GroupActivityDeletionModal
        open={deletionModal}
        setOpen={setDeletionModal}
        activityId={groupActivity.id}
        courseId={courseId}
      />
      <GroupActivityEndingModal
        open={endingModal}
        setOpen={setEndingModal}
        activityId={groupActivity.id}
        courseId={courseId}
      />
      <GroupActivityStartingModal
        open={startingModal}
        setOpen={setStartingModal}
        activityId={groupActivity.id}
        activityEndDate={groupActivity.scheduledEndAt}
        groupDeadlineDate={groupDeadlineDate}
        numOfParticipantGroups={numOfParticipantGroups}
        courseId={courseId}
      />
    </div>
  )
}

export default GroupActivityElement
