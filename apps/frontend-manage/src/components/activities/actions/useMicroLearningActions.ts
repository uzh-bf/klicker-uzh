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
import {
  ActivityInfo,
  ActivityType,
  GetSingleCourseDocument,
  GetUserActivitiesDocument,
  UnpublishMicroLearningDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Dispatch, SetStateAction, useMemo } from 'react'
import { ActivityAction } from './useAvailableActions'

function useMicroLearningActions({
  microLearning,
  setCopyToast,
  setPublishModal,
  setDeletionModal,
  setRemovalModal,
  setEndingModal,
  setExtensionModal,
  setSharingModal,
  setActivityLogOpen,
}: {
  microLearning: ActivityInfo
  setCopyToast: Dispatch<SetStateAction<boolean>>
  setPublishModal: Dispatch<SetStateAction<boolean>>
  setDeletionModal: Dispatch<SetStateAction<boolean>>
  setRemovalModal: Dispatch<SetStateAction<boolean>>
  setEndingModal: Dispatch<SetStateAction<boolean>>
  setExtensionModal: Dispatch<SetStateAction<boolean>>
  setSharingModal: Dispatch<SetStateAction<boolean>>
  setActivityLogOpen: Dispatch<SetStateAction<boolean>>
}): ActivityAction[] {
  const t = useTranslations()
  const router = useRouter()

  const [unpublishMicroLearning] = useMutation(UnpublishMicroLearningDocument)

  const href = `${process.env.NEXT_PUBLIC_PWA_URL}/course/${microLearning.courseId}/microlearning/${microLearning.id}/`
  const evaluationHref = `/microLearning/${microLearning.id}/evaluation`

  const actions = useMemo(
    () => [
      {
        id: 'publishMicroLearning',
        label: t('manage.course.publishMicrolearning'),
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
            setCopyToast(true)
          } catch (e) {}
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
            setCopyToast(true)
          } catch (e) {}
        },
        data: { cy: `copy-lti-link-${microLearning.name}` },
      },
      {
        id: 'openPreview',
        label: t('manage.courseList.openPreview'),
        icon: faMagnifyingGlass,
        onClick: () => {
          window.open(href, '_blank')
        },
        data: { cy: `open-microlearning-${microLearning.name}` },
      },
      {
        id: 'openEvaluation',
        label: t('manage.courseList.openEvaluation'),
        icon: faChartSimple,
        onClick: () => {
          window.open(evaluationHref, '_blank')
        },
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
        onClick: () => {
          router.push(
            `/analytics/${microLearning.courseId}/quizzes/${microLearning.id}`
          )
        },
        data: { cy: `open-analytics-async-activity` },
      },
      {
        id: 'shareMicroLearning',
        label: t('manage.course.shareMicroLearning'),
        icon: faShare,
        onClick: () => {
          setSharingModal(true)
        },
        data: { cy: `share-microlearning-${microLearning.name}` },
      },
      {
        id: 'unpublishMicrolearning',
        label: t('manage.course.unpublishMicrolearning'),
        icon: faLock,
        onClick: async () => {
          await unpublishMicroLearning({
            variables: { id: microLearning.id! },
            refetchQueries: [
              {
                query: GetSingleCourseDocument,
                variables: { courseId: microLearning.courseId },
              },
              { query: GetUserActivitiesDocument },
            ],
          })
        },
        data: { cy: `unpublish-microlearning-${microLearning.name}` },
        className: 'border-red-600 text-red-600 hover:text-red-600',
      },
      {
        id: 'removeMicroLearning',
        label: t('manage.course.removeMicroLearning'),
        icon: faX,
        onClick: () => {
          setRemovalModal(true)
        },
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
        label: t('shared.activity.viewComments'),
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
      evaluationHref,
      setPublishModal,
      setCopyToast,
      setExtensionModal,
      setEndingModal,
      setSharingModal,
      unpublishMicroLearning,
      setDeletionModal,
      setRemovalModal,
      setActivityLogOpen,
    ]
  )

  return actions
}

export default useMicroLearningActions
