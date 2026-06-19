import { UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { trpc } from '../../../lib/trpc'
import ConfirmationItem from '../../common/ConfirmationItem'
import ActivityConfirmationModal from './ActivityConfirmationModal'

interface GroupActivityStartingModalProps {
  onClose: () => void
  activityId: string
  activityEndDate: string
  courseId: string
  groupDeadlineDate: string
  numOfParticipantGroups: number
  refetchActivities?: () => Promise<void>
}

function GroupActivityStartingModal({
  onClose,
  activityId,
  activityEndDate,
  courseId,
  groupDeadlineDate,
  numOfParticipantGroups,
  refetchActivities,
}: GroupActivityStartingModalProps) {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const openGroupActivity = trpc.activity.openGroupActivity.useMutation()

  const [confirmations, setConfirmations] = useState({
    participantGroups: false,
    availableUntil: false,
  })

  // on open, reset confirmations
  useEffect(() => {
    setConfirmations({
      participantGroups: false,
      availableUntil: false,
    })
  }, [])

  return (
    <ActivityConfirmationModal
      onClose={onClose}
      title={t('manage.course.startGroupActivityNow')}
      message={t('manage.course.startGroupActivityNowMessage')}
      onSubmit={async () => {
        const result = await openGroupActivity.mutateAsync({ activityId })
        if (result.openGroupActivity?.id) {
          await utils.course.detail.invalidate({ courseId })
        }
        await refetchActivities?.()
      }}
      submitting={openGroupActivity.isLoading}
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
