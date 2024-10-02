import { useMutation } from '@apollo/client'
import {
  faCalendar,
  faHandPointer,
  faTrashCan,
} from '@fortawesome/free-regular-svg-icons'
import {
  faArrowsRotate,
  faCheck,
  faClock,
  faHourglassEnd,
  faHourglassStart,
  faLock,
  faPencil,
  faPlay,
  faUpRightFromSquare,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  DeleteGroupActivityDocument,
  GetSingleCourseDocument,
  GroupActivity,
  GroupActivityStatus,
  UnpublishGroupActivityDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Button, Dropdown } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { useState } from 'react'
import { WizardMode } from '../sessions/creation/ElementCreation'
import StatusTag from './StatusTag'
import PublishGroupActivityButton from './actions/PublishGroupActivityButton'
import DeletionModal from './modals/DeletionModal'
import ExtensionModal from './modals/ExtensionModal'

interface GroupActivityElementProps {
  groupActivity: Partial<GroupActivity> & Pick<GroupActivity, 'id' | 'name'>
  courseId: string
}

function GroupActivityElement({
  groupActivity,
  courseId,
}: GroupActivityElementProps) {
  const t = useTranslations()
  const router = useRouter()

  const [deletionModal, setDeletionModal] = useState(false)
  const [extensionModal, setExtensionModal] = useState(false)
  const isFuture = dayjs(groupActivity.scheduledStartAt).isAfter(dayjs())
  const isPast = dayjs(groupActivity.scheduledEndAt).isBefore(dayjs())

  const [unpublishGroupActivity] = useMutation(UnpublishGroupActivityDocument, {
    variables: {
      id: groupActivity.id,
    },
    refetchQueries: [
      { query: GetSingleCourseDocument, variables: { courseId: courseId } },
    ],
  })

  const [deleteGroupActivity] = useMutation(DeleteGroupActivityDocument, {
    variables: {
      id: groupActivity.id,
    },
    optimisticResponse: {
      __typename: 'Mutation',
      deleteGroupActivity: {
        __typename: 'GroupActivity',
        id: groupActivity.id,
      },
    },
    refetchQueries: [
      { query: GetSingleCourseDocument, variables: { courseId: courseId } },
    ],
  })

  const statusMap: Record<GroupActivityStatus, React.ReactElement> = {
    [GroupActivityStatus.Draft]: (
      <StatusTag
        color="bg-gray-200"
        status={t('shared.generic.draft')}
        icon={faPencil}
      />
    ),
    [GroupActivityStatus.Published]: (isFuture && (
      <StatusTag
        color="bg-green-300"
        status={t('shared.generic.scheduled')}
        icon={faClock}
      />
    )) ||
      (isPast && (
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
      )) || (
        <StatusTag
          color="bg-green-300"
          status={t('shared.generic.running')}
          icon={faPlay}
        />
      ),
    [GroupActivityStatus.Graded]: (isFuture && (
      <StatusTag
        color="bg-green-300"
        status={t('shared.generic.scheduled')}
        icon={faClock}
      />
    )) ||
      (isPast && (
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
      )) || (
        <StatusTag
          color="bg-green-300"
          status={t('shared.generic.running')}
          icon={faPlay}
        />
      ),
  }

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
                      <div className="text-primary-100 flex cursor-pointer flex-row items-center gap-2">
                        <FontAwesomeIcon icon={faPencil} />
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
                  {
                    label: (
                      <div className="flex cursor-pointer flex-row items-center gap-1 text-red-600">
                        <FontAwesomeIcon
                          icon={faTrashCan}
                          className="w-[1.1rem]"
                        />
                        <div>{t('manage.course.deleteGroupActivity')}</div>
                      </div>
                    ),
                    onClick: () => setDeletionModal(true),
                    data: {
                      cy: `delete-groupActivity-${groupActivity.name}`,
                    },
                  },
                ]}
                triggerIcon={faHandPointer}
              />
            </>
          )}

          {(groupActivity.status === GroupActivityStatus.Published ||
            groupActivity.status === GroupActivityStatus.Graded) && (
            <>
              {isPast && (
                <Link
                  href={`/courses/grading/groupActivity/${groupActivity.id}`}
                  data-cy={`grade-groupActivity-${groupActivity.name}`}
                >
                  <div className="text-primary-100 flex cursor-pointer flex-row items-center gap-1">
                    <FontAwesomeIcon
                      icon={faUpRightFromSquare}
                      className="w-[1.1rem]"
                    />
                    <div>{t('manage.course.gradeGroupActivity')}</div>
                  </div>
                </Link>
              )}
              {isFuture && (
                <Button
                  onClick={async () => await unpublishGroupActivity()}
                  data={{
                    cy: `unpublish-groupActivity-${groupActivity.name}`,
                  }}
                  basic
                >
                  <div className="flex cursor-pointer flex-row items-center gap-1 text-red-600">
                    <FontAwesomeIcon icon={faLock} className="w-[1.1rem]" />
                    <div>{t('manage.course.unpublishGroupActivity')}</div>
                  </div>
                </Button>
              )}
              {!isPast && !isFuture && (
                <Button
                  onClick={async () => setExtensionModal(true)}
                  data={{
                    cy: `extend-groupActivity-${groupActivity.name}`,
                  }}
                  basic
                >
                  <div className="text-primary-100 flex cursor-pointer flex-row items-center gap-1">
                    <FontAwesomeIcon icon={faCalendar} className="w-[1.1rem]" />
                    <div>{t('manage.course.extendMicroLearning')}</div>
                  </div>
                </Button>
              )}
            </>
          )}
        </div>

        <div>
          {statusMap[groupActivity.status ?? GroupActivityStatus.Draft]}
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
      <ExtensionModal
        type="groupActivity"
        id={groupActivity.id}
        currentEndDate={groupActivity.scheduledEndAt}
        courseId={courseId}
        title={t('manage.course.extendGroupActivity')}
        description={t('manage.course.extendGroupActivityDescription')}
        open={extensionModal}
        setOpen={setExtensionModal}
      />
    </div>
  )
}

export default GroupActivityElement
