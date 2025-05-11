import { useMutation } from '@apollo/client'
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
  faPencil,
  faShare,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import {
  ActivityInfo,
  ActivityType,
  GetSingleCourseDocument,
  GetUserActivitiesDocument,
  UnpublishPracticeQuizDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Dispatch, SetStateAction, useMemo } from 'react'
import { ActivityAction } from './useAvailableActions'

function usePracticeQuizActions({
  practiceQuiz,
  setPublishModal,
  setDeletionModal,
  setSharingModal,
  setCopyToast,
}: {
  practiceQuiz: ActivityInfo
  setPublishModal: Dispatch<SetStateAction<boolean>>
  setDeletionModal: Dispatch<SetStateAction<boolean>>
  setSharingModal: Dispatch<SetStateAction<boolean>>
  setCopyToast: Dispatch<SetStateAction<boolean>>
}): ActivityAction[] {
  const t = useTranslations()
  const router = useRouter()

  const [unpublishPracticeQuiz] = useMutation(UnpublishPracticeQuizDocument)

  const href = `${process.env.NEXT_PUBLIC_PWA_URL}/course/${practiceQuiz.courseId}/quiz/${practiceQuiz.id}/`
  const evaluationHref = `/practiceQuiz/${practiceQuiz.id}/evaluation`

  const actions = useMemo(
    () => [
      {
        id: 'publishPracticeQuiz',
        label: t('manage.course.publishPracticeQuiz'),
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
            setCopyToast(true)
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
            setCopyToast(true)
          } catch (e) {}
        },
        data: { cy: `copy-lti-link-${practiceQuiz.name}` },
      },
      {
        id: 'openPreview',
        label: t('manage.courseList.openPreview'),
        icon: faMagnifyingGlass,
        onClick: () => {
          window.open(href, '_blank')
        },
        data: { cy: `open-practice-quiz-${practiceQuiz.name}` },
      },
      {
        id: 'openEvaluation',
        label: t('manage.courseList.openEvaluation'),
        icon: faChartSimple,
        onClick: () => {
          window.open(evaluationHref, '_blank')
        },
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
        onClick: () => {
          router.push(
            `/analytics/${practiceQuiz.courseId}/quizzes/${practiceQuiz.id}`
          )
        },
        data: { cy: `open-analytics-async-activity` },
      },
      {
        id: 'sharePracticeQuiz',
        label: t('manage.course.sharePracticeQuiz'),
        icon: faShare,
        onClick: () => {
          setSharingModal(true)
        },
        data: { cy: `share-practice-quiz-${practiceQuiz.name}` },
      },
      {
        id: 'unpublishPracticeQuiz',
        label: t('manage.course.unpublishPracticeQuiz'),
        icon: faLock,
        onClick: async () => {
          await unpublishPracticeQuiz({
            variables: { id: practiceQuiz.id! },
            refetchQueries: [
              {
                query: GetSingleCourseDocument,
                variables: { courseId: practiceQuiz.courseId },
              },
              { query: GetUserActivitiesDocument },
            ],
          })
        },
        data: { cy: `unpublish-practice-quiz-${practiceQuiz.name}` },
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
    ],
    [
      t,
      router,
      practiceQuiz,
      setPublishModal,
      setDeletionModal,
      setSharingModal,
      setCopyToast,
    ]
  )

  return actions
}

export default usePracticeQuizActions
