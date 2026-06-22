import { faCalendar, faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  faFlagCheckered,
  faGraduationCap,
  faLock,
  faMessage,
  faPencil,
  faPlay,
  faShare,
  faUserGroup,
  faX,
} from '@fortawesome/free-solid-svg-icons'
import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Dispatch, SetStateAction, useMemo, useState } from 'react'
import {
  ActivityType,
  type ActivityInfo,
} from '../../../lib/constants/activityEnums'
import { trpc, type RouterInputs } from '../../../lib/trpc'
import { ActivityAction } from './useAvailableActions'

function useGroupActivityActions({
  groupActivity,
  setRemovalModal,
  setDeletionModal,
  setEndingModal,
  setStartingModal,
  setPublishingModal,
  setExtensionModal,
  setSharingModal,
  setActivityLogOpen,
  refetchActivities,
}: {
  groupActivity: ActivityInfo
  setRemovalModal: Dispatch<SetStateAction<boolean>>
  setDeletionModal: Dispatch<SetStateAction<boolean>>
  setEndingModal: Dispatch<SetStateAction<boolean>>
  setStartingModal: Dispatch<SetStateAction<boolean>>
  setPublishingModal: Dispatch<SetStateAction<boolean>>
  setExtensionModal: Dispatch<SetStateAction<boolean>>
  setSharingModal: Dispatch<SetStateAction<boolean>>
  setActivityLogOpen: Dispatch<SetStateAction<boolean>>
  refetchActivities?: () => Promise<void>
}): ActivityAction[] {
  const t = useTranslations()
  const router = useRouter()
  const utils = trpc.useUtils()
  const unpublishGroupActivity = trpc.activity.unpublish.useMutation()
  const [unpublishRefreshing, setUnpublishRefreshing] = useState(false)
  const unpublishing = unpublishGroupActivity.isLoading || unpublishRefreshing

  const actions = useMemo(
    () => [
      {
        id: 'publishGroupActivity',
        label: t('manage.course.publishItemGROUP_ACTIVITY'),
        icon: faUserGroup,
        onClick: () => setPublishingModal(true),
        data: { cy: `publish-group-activity-${groupActivity.name}` },
      },
      {
        id: 'editGroupActivity',
        label: t('manage.course.editGroupActivity'),
        icon: faPencil,
        onClick: () =>
          router.push({
            pathname: '/',
            query: {
              elementId: groupActivity.id,
              editMode: ActivityType.GroupActivity,
            },
          }),
        data: { cy: `edit-group-activity-${groupActivity.name}` },
      },
      {
        id: 'unpublishGroupActivity',
        label: t('manage.course.unpublishGroupActivity'),
        icon: faLock,
        onClick: async () => {
          setUnpublishRefreshing(true)
          try {
            const result = await unpublishGroupActivity.mutateAsync({
              activityId: groupActivity.id,
              activityType:
                ActivityType.GroupActivity as RouterInputs['activity']['unpublish']['activityType'],
            })
            if (result.unpublishActivity?.id) {
              await Promise.all([
                groupActivity.courseId
                  ? utils.course.detail.invalidate({
                      courseId: groupActivity.courseId,
                    })
                  : undefined,
                refetchActivities?.(),
              ]).catch(console.error)
            } else {
              toast({
                type: 'error',
                message: t('shared.generic.systemError'),
              })
            }
          } catch (error) {
            console.error(error)
            toast({
              type: 'error',
              message: t('shared.generic.systemError'),
            })
          } finally {
            setUnpublishRefreshing(false)
          }
        },
        disabled: unpublishing,
        data: { cy: `unpublish-group-activity-${groupActivity.name}` },
        className: 'border-red-600 text-red-600 hover:text-red-600',
      },
      {
        id: 'startGroupActivityNow',
        label: t('manage.course.startGroupActivityNow'),
        icon: faPlay,
        onClick: () => setStartingModal(true),
        data: { cy: `start-group-activity-${groupActivity.name}-now` },
      },
      {
        id: 'extendGroupActivity',
        label: t('manage.course.extendGroupActivity'),
        icon: faCalendar,
        onClick: () => setExtensionModal(true),
        data: { cy: `extend-group-activity-${groupActivity.name}` },
      },
      {
        id: 'endGroupActivity',
        label: t('manage.course.endGroupActivity'),
        icon: faFlagCheckered,
        onClick: () => setEndingModal(true),
        data: { cy: `end-group-activity-${groupActivity.name}` },
      },
      {
        id: 'gradeGroupActivity',
        label: t('manage.course.gradeGroupActivity'),
        icon: faGraduationCap,
        onClick: () =>
          router.push({
            pathname: `/courses/grading/groupActivity/${groupActivity.id}`,
          }),
        data: { cy: `grade-group-activity-${groupActivity.name}` },
      },
      {
        id: 'shareGroupActivity',
        label: t('manage.course.shareGroupActivity'),
        icon: faShare,
        onClick: () => setSharingModal(true),
        data: { cy: `share-group-activity-${groupActivity.name}` },
      },
      {
        id: 'removeGroupActivity',
        label: t('manage.course.removeGroupActivity'),
        icon: faX,
        onClick: () => setRemovalModal(true),
        data: { cy: `remove-group-activity-${groupActivity.name}` },
        className: 'border-red-600 text-red-600 hover:text-red-600',
      },
      {
        id: 'deleteGroupActivity',
        label: t('manage.course.deleteGroupActivity'),
        icon: faTrashCan,
        onClick: () => setDeletionModal(true),
        data: { cy: `delete-group-activity-${groupActivity.name}` },
        className: 'border-red-600 text-red-600 hover:text-red-600',
      },
      {
        id: 'activityLog',
        label: t('shared.comments.viewComments'),
        icon: faMessage,
        onClick: () => setActivityLogOpen(true),
        data: { cy: `view-activity-log-${groupActivity.name}` },
      },
    ],
    [
      t,
      router,
      groupActivity.id,
      groupActivity.name,
      groupActivity.courseId,
      unpublishGroupActivity,
      unpublishing,
      utils,
      refetchActivities,
      setRemovalModal,
      setDeletionModal,
      setEndingModal,
      setStartingModal,
      setPublishingModal,
      setExtensionModal,
      setSharingModal,
      setActivityLogOpen,
    ]
  )

  return actions
}

export default useGroupActivityActions
