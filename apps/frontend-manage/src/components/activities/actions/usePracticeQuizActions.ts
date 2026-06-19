import {
  faCopy as faCopyRegular,
  faTrashCan,
} from '@fortawesome/free-regular-svg-icons'
import {
  faChartPie,
  faChartSimple,
  faCopy,
  faLink,
  faLock,
  faMagnifyingGlass,
  faMessage,
  faPencil,
  faShare,
  faUserGroup,
  faX,
} from '@fortawesome/free-solid-svg-icons'
import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Dispatch, SetStateAction, useMemo } from 'react'
import {
  ActivityType,
  type ActivityInfo,
} from '../../../lib/constants/activityEnums'
import { trpc } from '../../../lib/trpc'
import { ActivityAction } from './useAvailableActions'

function usePracticeQuizActions({
  practiceQuiz,
  setPublishModal,
  setDeletionModal,
  setSharingModal,
  setRemovalModal,
  setActivityLogOpen,
  refetchActivities,
}: {
  practiceQuiz: ActivityInfo
  setPublishModal: Dispatch<SetStateAction<boolean>>
  setDeletionModal: Dispatch<SetStateAction<boolean>>
  setSharingModal: Dispatch<SetStateAction<boolean>>
  setRemovalModal: Dispatch<SetStateAction<boolean>>
  setActivityLogOpen: Dispatch<SetStateAction<boolean>>
  refetchActivities?: () => Promise<void>
}): ActivityAction[] {
  const t = useTranslations()
  const router = useRouter()
  const utils = trpc.useUtils()
  const unpublishPracticeQuiz = trpc.activity.unpublish.useMutation()
  const href = `${process.env.NEXT_PUBLIC_PWA_URL}${practiceQuiz.courseLanguage ? `/${practiceQuiz.courseLanguage}` : ''}/course/${practiceQuiz.courseId}/practiceQuizzes/${practiceQuiz.id}/`

  const onSuccessToast = () =>
    toast({
      type: 'success',
      message: t('manage.course.linkAccessCopied'),
      options: { duration: 4000 },
    })

  const actions = useMemo(
    () => [
      {
        id: 'publishPracticeQuiz',
        label: t('manage.course.publishItemPRACTICE_QUIZ'),
        icon: faUserGroup,
        onClick: () => setPublishModal(true),
        data: { cy: `publish-practice-quiz-${practiceQuiz.name}` },
      },
      {
        id: 'copyAccessLink',
        label: t('manage.course.copyAccessLink'),
        icon: faCopy,
        onClick: () => {
          try {
            navigator.clipboard.writeText(href)
            onSuccessToast()
          } catch (e) {}
        },
        data: { cy: `copy-access-link-${practiceQuiz.name}` },
      },
      {
        id: 'copyLTIAccessLink',
        label: t('manage.course.copyLTIAccessLink'),
        icon: faLink,
        onClick: async () => {
          try {
            const link = `${process.env.NEXT_PUBLIC_LTI_URL}?redirectTo=${href}`
            await navigator.clipboard.writeText(link)
            onSuccessToast()
          } catch (e) {}
        },
        data: { cy: `copy-lti-link-${practiceQuiz.name}` },
      },
      {
        id: 'openPreview',
        label: t('manage.courseList.openPreview'),
        icon: faMagnifyingGlass,
        onClick: () => window.open(href, '_blank'),
        data: { cy: `open-practice-quiz-${practiceQuiz.name}` },
      },
      {
        id: 'openEvaluation',
        label: t('manage.courseList.openEvaluation'),
        icon: faChartSimple,
        onClick: () =>
          window.open(
            `${router.locale ? `/${router.locale}` : ''}/practiceQuiz/${practiceQuiz.id}/evaluation`,
            '_blank'
          ),
        data: { cy: `evaluation-practice-quiz-${practiceQuiz.name}` },
      },
      {
        id: 'editPracticeQuiz',
        label: t('manage.course.editPracticeQuiz'),
        icon: faPencil,
        onClick: () =>
          router.push({
            pathname: '/',
            query: {
              elementId: practiceQuiz.id,
              editMode: ActivityType.PracticeQuiz,
            },
          }),
        data: { cy: `edit-practice-quiz-${practiceQuiz.name}` },
      },
      {
        id: 'duplicatePracticeQuiz',
        label: t('manage.course.duplicatePracticeQuiz'),
        icon: faCopyRegular,
        onClick: () =>
          router.push({
            pathname: '/',
            query: {
              elementId: practiceQuiz.id,
              duplicationMode: ActivityType.PracticeQuiz,
            },
          }),
        data: { cy: `duplicate-practice-quiz-${practiceQuiz.name}` },
      },
      {
        id: 'analyticsPracticeQuiz',
        label: t('manage.courseList.activityAnalytics'),
        icon: faChartPie,
        onClick: () =>
          router.push(
            `/analytics/${practiceQuiz.courseId}/quizzes/${practiceQuiz.id}`
          ),
        data: { cy: `open-analytics-async-activity` },
      },
      {
        id: 'sharePracticeQuiz',
        label: t('manage.course.sharePracticeQuiz'),
        icon: faShare,
        onClick: () => setSharingModal(true),
        data: { cy: `share-practice-quiz-${practiceQuiz.name}` },
      },
      {
        id: 'unpublishPracticeQuiz',
        label: t('manage.course.unpublishPracticeQuiz'),
        icon: faLock,
        onClick: async () => {
          const result = await unpublishPracticeQuiz.mutateAsync({
            activityId: practiceQuiz.id,
            activityType: ActivityType.PracticeQuiz,
          })
          if (practiceQuiz.courseId && result.unpublishActivity?.id) {
            await utils.course.detail.invalidate({
              courseId: practiceQuiz.courseId,
            })
          }
          await refetchActivities?.()
        },
        disabled: unpublishPracticeQuiz.isLoading,
        data: { cy: `unpublish-practice-quiz-${practiceQuiz.name}` },
        className: 'border-red-600 text-red-600 hover:text-red-600',
      },
      {
        id: 'removePracticeQuiz',
        label: t('manage.course.removePracticeQuiz'),
        icon: faX,
        onClick: () => setRemovalModal(true),
        data: { cy: `remove-practice-quiz-${practiceQuiz.name}` },
        className: 'border-red-600 text-red-600 hover:text-red-600',
      },
      {
        id: 'deletePracticeQuiz',
        label: t('manage.course.deletePracticeQuiz'),
        icon: faTrashCan,
        onClick: () => setDeletionModal(true),
        data: { cy: `delete-practice-quiz-${practiceQuiz.name}` },
        className: 'border-red-600 text-red-600 hover:text-red-600',
      },
      {
        id: 'activityLog',
        label: t('shared.comments.viewComments'),
        icon: faMessage,
        onClick: () => setActivityLogOpen(true),
        data: { cy: `view-activity-log-${practiceQuiz.name}` },
      },
    ],
    [
      t,
      practiceQuiz.id,
      practiceQuiz.name,
      practiceQuiz.courseId,
      href,
      router,
      setPublishModal,
      setSharingModal,
      setRemovalModal,
      unpublishPracticeQuiz,
      utils,
      refetchActivities,
      setDeletionModal,
      setActivityLogOpen,
    ]
  )

  return actions
}

export default usePracticeQuizActions
