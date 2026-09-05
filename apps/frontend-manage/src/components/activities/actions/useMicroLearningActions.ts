import { useMutation } from '@apollo/client'
import {
  faCalendar,
  faCopy as faCopyRegular,
  faTrashCan,
} from '@fortawesome/free-regular-svg-icons'
import {
  faArrowsRotate,
  faChartPie,
  faChartSimple,
  faCopy,
  faFlagCheckered,
  faLink,
  faLock,
  faMagnifyingGlass,
  faMessage,
  faPencil,
  faShare,
  faUserGroup,
  faX,
} from '@fortawesome/free-solid-svg-icons'
import { useFeatureFlag } from '@klicker-uzh/feature-flags/react'
import {
  type ActivityInfo,
  ActivityType,
  GetSingleCourseDocument,
  UnpublishMicroLearningDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { toast } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { type Dispatch, type SetStateAction, useCallback, useMemo } from 'react'
import type { ActivityAction } from './useAvailableActions'

function useMicroLearningActions({
  microLearning,
  setPublishModal,
  setDeletionModal,
  setRemovalModal,
  setEndingModal,
  setExtensionModal,
  setSharingModal,
  setActivityLogOpen,
  refetchActivities,
}: {
  microLearning: ActivityInfo
  setPublishModal: Dispatch<SetStateAction<boolean>>
  setDeletionModal: Dispatch<SetStateAction<boolean>>
  setRemovalModal: Dispatch<SetStateAction<boolean>>
  setEndingModal: Dispatch<SetStateAction<boolean>>
  setExtensionModal: Dispatch<SetStateAction<boolean>>
  setSharingModal: Dispatch<SetStateAction<boolean>>
  setActivityLogOpen: Dispatch<SetStateAction<boolean>>
  refetchActivities?: () => Promise<void>
}): ActivityAction[] {
  const t = useTranslations()
  const router = useRouter()
  const learningAnalyticsEnabled = useFeatureFlag('learning-analytics')
  const [unpublishMicroLearning, { loading: unpublishing }] = useMutation(
    UnpublishMicroLearningDocument
  )
  const onSuccessToast = useCallback(
    () =>
      toast({
        type: 'success',
        message: t('manage.course.linkAccessCopied'),
        options: { duration: 4000 },
      }),
    [t]
  )

  const href = `${process.env.NEXT_PUBLIC_PWA_URL}${microLearning.courseLanguage ? `/${microLearning.courseLanguage}` : ''}/course/${microLearning.courseId}/microLearnings/${microLearning.id}/`
  const actions = useMemo(
    () => [
      {
        id: 'publishMicroLearning',
        label: t('manage.course.publishItemMICROLEARNING'),
        icon: faUserGroup,
        onClick: () => setPublishModal(true),
        data: { cy: `publish-microlearning-${microLearning.name}` },
      },
      {
        id: 'copyAccessLink',
        label: t('manage.course.copyAccessLink'),
        icon: faCopy,
        onClick: () => {
          try {
            navigator.clipboard.writeText(href)
            onSuccessToast()
          } catch {}
        },
        data: { cy: `copy-microlearning-link-${microLearning.name}` },
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
          } catch {}
        },
        data: { cy: `copy-lti-link-${microLearning.name}` },
      },
      {
        id: 'openPreview',
        label: t('manage.courseList.openPreview'),
        icon: faMagnifyingGlass,
        onClick: () => window.open(href, '_blank'),
        data: { cy: `open-microlearning-${microLearning.name}` },
      },
      {
        id: 'openEvaluation',
        label: t('manage.courseList.openEvaluation'),
        icon: faChartSimple,
        onClick: () =>
          window.open(
            `${router.locale ? `/${router.locale}` : ''}/microLearning/${microLearning.id}/evaluation`,
            '_blank'
          ),
        data: { cy: `evaluation-microlearning-${microLearning.name}` },
      },
      {
        id: 'editMicroLearning',
        label: t('manage.course.editMicrolearning'),
        icon: faPencil,
        onClick: () =>
          router.push({
            pathname: '/',
            query: {
              elementId: microLearning.id,
              editMode: ActivityType.MicroLearning,
            },
          }),
        data: { cy: `edit-microlearning-${microLearning.name}` },
      },
      {
        id: 'duplicateMicroLearning',
        label: t('manage.course.duplicateMicroLearning'),
        icon: faCopyRegular,
        onClick: () =>
          router.push({
            pathname: '/',
            query: {
              elementId: microLearning.id,
              duplicationMode: ActivityType.MicroLearning,
            },
          }),
        data: { cy: `duplicate-microlearning-${microLearning.name}` },
      },
      {
        id: 'convertToPracticeQuiz',
        label: t('manage.course.convertMicroLearningToPracticeQuiz'),
        icon: faArrowsRotate,
        onClick: () =>
          router.push({
            pathname: '/',
            query: {
              elementId: microLearning.id,
              conversionMode: 'microLearningToPracticeQuiz',
            },
          }),
        data: {
          cy: `convert-microlearning-${microLearning.name}-to-practice-quiz`,
        },
      },
      {
        id: 'extendMicroLearning',
        label: t('manage.course.extendMicroLearning'),
        icon: faCalendar,
        onClick: () => setExtensionModal(true),
        data: { cy: `extend-microlearning-${microLearning.name}` },
      },
      {
        id: 'endMicroLearning',
        label: t('manage.course.endMicroLearning'),
        icon: faFlagCheckered,
        onClick: () => setEndingModal(true),
        data: { cy: `end-microlearning-${microLearning.name}` },
      },
      {
        id: 'analyticsMicroLearning',
        label: t('manage.courseList.activityAnalytics'),
        icon: faChartPie,
        onClick: () =>
          router.push(
            `/analytics/${microLearning.courseId}/quizzes/${microLearning.id}`
          ),
        disabled: !learningAnalyticsEnabled,
        tooltip: !learningAnalyticsEnabled
          ? t('manage.analytics.featureUnavailable')
          : undefined,
        data: {
          cy: `open-analytics-microlearning-${microLearning.name}`,
        },
      },
      {
        id: 'shareMicroLearning',
        label: t('manage.course.shareMicroLearning'),
        icon: faShare,
        onClick: () => setSharingModal(true),
        data: { cy: `share-microlearning-${microLearning.name}` },
      },
      {
        id: 'unpublishMicrolearning',
        label: t('manage.course.unpublishMicrolearning'),
        icon: faLock,
        onClick: async () => {
          await unpublishMicroLearning({
            variables: { id: microLearning.id! },
            update: (cache, { data: res }) => {
              // if the mutation was not successful, return early
              if (!res?.unpublishMicroLearning?.id) return

              // change the status of the practice quiz on the course overview back to draft
              cache.updateQuery(
                {
                  query: GetSingleCourseDocument,
                  variables: { courseId: microLearning.courseId! },
                },
                (data) => {
                  if (!data?.course) return data

                  return {
                    course: {
                      ...data.course,
                      microLearningsInfo: data.course.microLearningsInfo?.map(
                        (quiz) =>
                          quiz.id === res.unpublishMicroLearning?.id
                            ? {
                                ...quiz,
                                status: res.unpublishMicroLearning?.status,
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
        data: { cy: `unpublish-microlearning-${microLearning.name}` },
        className: 'border-red-600 text-red-600 hover:text-red-600',
      },
      {
        id: 'removeMicroLearning',
        label: t('manage.course.removeMicroLearning'),
        icon: faX,
        onClick: () => setRemovalModal(true),
        data: { cy: `remove-microlearning-${microLearning.name}` },
        className: 'border-red-600 text-red-600 hover:text-red-600',
      },
      {
        id: 'deleteMicroLearning',
        label: t('manage.course.deleteMicroLearning'),
        icon: faTrashCan,
        onClick: () => setDeletionModal(true),
        data: { cy: `delete-microlearning-${microLearning.name}` },
        className: 'border-red-600 text-red-600 hover:text-red-600',
      },
      {
        id: 'activityLog',
        label: t('shared.comments.viewComments'),
        icon: faMessage,
        onClick: () => setActivityLogOpen(true),
        data: { cy: `view-activity-log-${microLearning.name}` },
      },
    ],
    [
      t,
      router,
      microLearning.id,
      microLearning.name,
      microLearning.courseId,
      href,
      learningAnalyticsEnabled,
      setPublishModal,
      setExtensionModal,
      setEndingModal,
      setSharingModal,
      unpublishMicroLearning,
      setDeletionModal,
      setRemovalModal,
      setActivityLogOpen,
      onSuccessToast,
      refetchActivities,
      unpublishing,
    ]
  )

  return actions
}

export default useMicroLearningActions
