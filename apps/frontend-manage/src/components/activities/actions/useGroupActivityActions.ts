import { useMutation } from '@apollo/client'
import { faCalendar, faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  faFlagCheckered,
  faGraduationCap,
  faLock,
  faPencil,
  faPlay,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import {
  ActivityInfo,
  ActivityType,
  GetSingleCourseDocument,
  GetUserActivitiesDocument,
  UnpublishGroupActivityDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Dispatch, SetStateAction, useMemo } from 'react'
import { ActivityAction } from './useAvailableActions'

function useGroupActivityActions({
  groupActivity,
  setDeletionModal,
  setEndingModal,
  setStartingModal,
  setPublishingModal,
  setExtensionModal,
}: {
  groupActivity: ActivityInfo
  setDeletionModal: Dispatch<SetStateAction<boolean>>
  setEndingModal: Dispatch<SetStateAction<boolean>>
  setStartingModal: Dispatch<SetStateAction<boolean>>
  setPublishingModal: Dispatch<SetStateAction<boolean>>
  setExtensionModal: Dispatch<SetStateAction<boolean>>
}): ActivityAction[] {
  const t = useTranslations()
  const router = useRouter()

  const [unpublishGroupActivity, { loading: unpublishing }] = useMutation(
    UnpublishGroupActivityDocument,
    {
      variables: {
        id: groupActivity.id,
      },
      refetchQueries: [
        { query: GetUserActivitiesDocument },
        {
          query: GetSingleCourseDocument,
          variables: { courseId: groupActivity.courseId! },
        },
      ],
    }
  )

  const actions = useMemo(
    () => [
      {
        id: 'publishGroupActivity',
        label: t('manage.course.publishGroupActivity'),
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
        id: 'deleteGroupActivity',
        label: t('manage.course.deleteGroupActivity'),
        icon: faTrashCan,
        onClick: () => setDeletionModal(true),
        data: { cy: `delete-group-activity-${groupActivity.name}` },
        className: 'border-red-600 text-red-600 hover:text-red-600',
      },
      {
        id: 'unpublishGroupActivity',
        label: t('manage.course.unpublishGroupActivity'),
        icon: faLock,
        onClick: () => unpublishGroupActivity(),
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
    ],
    [
      t,
      router,
      groupActivity,
      unpublishing,
      setPublishingModal,
      setDeletionModal,
      unpublishGroupActivity,
      setStartingModal,
      setExtensionModal,
      setEndingModal,
    ]
  )

  return actions
}

export default useGroupActivityActions
