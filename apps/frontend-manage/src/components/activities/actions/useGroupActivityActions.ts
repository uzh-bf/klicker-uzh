import { useMutation } from '@apollo/client'
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
import {
  ActivityInfo,
  ActivityType,
  GetSingleCourseDocument,
  UnpublishGroupActivityDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Dispatch, SetStateAction, useMemo } from 'react'
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
  const [unpublishGroupActivity, { loading: unpublishing }] = useMutation(
    UnpublishGroupActivityDocument
  )

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
          await unpublishGroupActivity({
            variables: { id: groupActivity.id! },
            update: (cache, { data: res }) => {
              // if the mutation was not successful, return early
              if (!res?.unpublishGroupActivity?.id) return

              // change the status of the practice quiz on the course overview back to draft
              cache.updateQuery(
                {
                  query: GetSingleCourseDocument,
                  variables: { courseId: groupActivity.courseId! },
                },
                (data) => {
                  if (!data?.course) return data

                  return {
                    course: {
                      ...data.course,
                      groupActivitiesInfo: data.course.groupActivitiesInfo?.map(
                        (quiz) =>
                          quiz.id === res.unpublishGroupActivity?.id
                            ? {
                                ...quiz,
                                status: res.unpublishGroupActivity?.status,
                              }
                            : quiz
                      ),
                    },
                  }
                }
              )
            },
          })
          await refetchActivities?.()
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
