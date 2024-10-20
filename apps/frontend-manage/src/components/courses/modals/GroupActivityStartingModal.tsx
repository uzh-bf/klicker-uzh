import { useMutation } from '@apollo/client'
import {
  GetSingleCourseDocument,
  GroupActivityStatus,
  OpenGroupActivityDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import ConfirmationItem from '../../common/ConfirmationItem'
import ActivityConfirmationModal from './ActivityConfirmationModal'

interface GroupActivityStartingModalProps {
  open: boolean
  setOpen: (open: boolean) => void
  activityId: string
  activityEndDate: string
  courseId: string
  groupDeadlineDate: string
  numOfParticipantGroups: number
}

function GroupActivityStartingModal({
  open,
  setOpen,
  activityId,
  activityEndDate,
  courseId,
  groupDeadlineDate,
  numOfParticipantGroups,
}: GroupActivityStartingModalProps) {
  const t = useTranslations()

  const [openGroupActivity, { loading: openingGroupActivity }] = useMutation(
    OpenGroupActivityDocument,
    {
      variables: { id: activityId },
      optimisticResponse: {
        __typename: 'Mutation',
        openGroupActivity: {
          id: activityId,
          status: GroupActivityStatus.Published,
          scheduledStartAt: new Date(),
          __typename: 'GroupActivity',
        },
      },
      refetchQueries: [
        { query: GetSingleCourseDocument, variables: { courseId } },
      ],
    }
  )

  const [confirmations, setConfirmations] = useState({
    participantGroups: false,
    availableUntil: false,
  })

  // on open, reset confirmations
  useEffect(() => {
    if (open) {
      setConfirmations({
        participantGroups: false,
        availableUntil: false,
      })
    }
  }, [open])

  return (
    <ActivityConfirmationModal
      open={open}
      setOpen={setOpen}
      title={t('manage.course.startGroupActivityNow')}
      message={t('manage.course.startGroupActivityNowMessage')}
      onSubmit={async () => await openGroupActivity()}
      submitting={openingGroupActivity}
      confirmations={confirmations}
      confirmationsInitializing={false}
      confirmationType="confirm"
    >
      {numOfParticipantGroups === 0 ||
      dayjs(groupDeadlineDate).isAfter(dayjs()) ? (
        <UserNotification
          type="warning"
          message={
            numOfParticipantGroups === 0
              ? t('manage.course.noParticipantGroupsAvailable')
              : t('manage.course.groupFormationNotCompleted')
          }
          className={{ message: 'text-base' }}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <ConfirmationItem
            label={t('manage.course.numOfParticipantGroupsGettingAccess', {
              number: numOfParticipantGroups,
            })}
            onClick={() => {
              setConfirmations((prev) => ({
                ...prev,
                participantGroups: true,
              }))
            }}
            confirmed={confirmations.participantGroups}
            notApplicable={false}
            confirmationType="confirm"
            data={{ cy: 'confirm-groups-getting-access' }}
          />
          <ConfirmationItem
            label={t('manage.course.groupActivityAvailableUntil', {
              date: dayjs(activityEndDate).format('DD.MM.YYYY, HH:mm'),
            })}
            onClick={() => {
              setConfirmations((prev) => ({
                ...prev,
                availableUntil: true,
              }))
            }}
            confirmed={confirmations.availableUntil}
            notApplicable={false}
            confirmationType="confirm"
            data={{ cy: 'confirm-activity-available-until' }}
          />
        </div>
      )}
    </ActivityConfirmationModal>
  )
}

export default GroupActivityStartingModal
