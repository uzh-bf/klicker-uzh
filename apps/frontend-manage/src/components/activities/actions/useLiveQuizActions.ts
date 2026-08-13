import { useMutation } from '@apollo/client'
import { faWpforms } from '@fortawesome/free-brands-svg-icons'
import {
  faClock,
  faCopy,
  faTrashCan,
} from '@fortawesome/free-regular-svg-icons'
import {
  faArrowsRotate,
  faChalkboardUser,
  faChartSimple,
  faCode,
  faFileCircleCheck,
  faFilePen,
  faLock,
  faMessage,
  faPencil,
  faPlay,
  faQrcode,
  faShare,
  faX,
} from '@fortawesome/free-solid-svg-icons'
import {
  ActivityInfo,
  ActivityType,
  GetSingleCourseDocument,
  GetUserActivitiesDocument,
  UnpublishLiveQuizDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Dispatch, SetStateAction, useMemo } from 'react'
import { ActivityAction } from './useAvailableActions'

function useLiveQuizActions({
  quiz,
  onStart,
  starting,
  setSchedulingModal,
  setEmbeddingModal,
  setQRModal,
  setTemplateEditingModal,
  setTemplateDeletionModal,
  setConversionModal,
  setSharingModal,
  setRemovalModal,
  setDeletionModal,
  setActivityLogOpen,
  setResetModal,
}: {
  quiz: ActivityInfo
  onStart: any
  starting: boolean
  setSchedulingModal: Dispatch<SetStateAction<boolean>>
  setEmbeddingModal: Dispatch<SetStateAction<boolean>>
  setQRModal: Dispatch<SetStateAction<boolean>>
  setTemplateEditingModal: Dispatch<SetStateAction<boolean>>
  setTemplateDeletionModal: Dispatch<SetStateAction<boolean>>
  setConversionModal: Dispatch<
    SetStateAction<{
      open: boolean
      activityId: string
      activityType: ActivityType
    }>
  >
  setSharingModal: Dispatch<SetStateAction<boolean>>
  setRemovalModal: Dispatch<SetStateAction<boolean>>
  setDeletionModal: Dispatch<SetStateAction<boolean>>
  setActivityLogOpen: Dispatch<SetStateAction<boolean>>
  setResetModal: Dispatch<SetStateAction<boolean>>
}): ActivityAction[] {
  const t = useTranslations()
  const router = useRouter()
  const [unpublishLiveQuiz] = useMutation(UnpublishLiveQuizDocument)

  const actions = useMemo(
    () => [
      {
        id: 'startLiveQuiz',
        label: t('manage.liveQuizzes.startLiveQuiz'),
        icon: faPlay,
        onClick: async () => {
          await onStart()
          router.push(`/quizzes/${quiz.id}/cockpit`)
        },
        disabled: starting,
        data: { cy: `start-live-quiz-${quiz.name}` },
      },
      {
        id: 'scheduleLiveQuiz',
        label: t('manage.liveQuizzes.scheduleLiveQuiz'),
        icon: faClock,
        onClick: async () => setSchedulingModal(true),
        data: { cy: `schedule-live-quiz-${quiz.name}` },
      },
      {
        id: 'editLiveQuiz',
        label: t('manage.liveQuizzes.editLiveQuiz'),
        icon: faPencil,
        onClick: () =>
          router.push({
            pathname: '/',
            query: {
              elementId: quiz.id,
              editMode: ActivityType.LiveQuiz,
            },
          }),
        data: { cy: `edit-live-quiz-${quiz.name}` },
      },
      {
        id: 'lecturerCockpit',
        label: t('manage.liveQuizzes.lecturerCockpit'),
        icon: faChalkboardUser,
        onClick: () => router.push(`/quizzes/${quiz.id}/cockpit`),
        data: { cy: `live-quiz-cockpit-${quiz.name}` },
      },
      {
        id: 'liveQuizEvaluation',
        label: t('manage.liveQuizzes.liveQuizEvaluation'),
        icon: faChartSimple,
        onClick: () =>
          window.open(
            `${router.locale ? `/${router.locale}` : ''}/quizzes/${quiz.id}/evaluation`,
            '_blank'
          ),
        data: { cy: `live-quiz-evaluation-${quiz.name}` },
      },
      {
        id: 'duplicateLiveQuiz',
        label: t('manage.liveQuizzes.duplicateLiveQuiz'),
        icon: faCopy,
        onClick: () =>
          router.push({
            pathname: '/',
            query: {
              elementId: quiz.id,
              duplicationMode: ActivityType.LiveQuiz,
            },
          }),
        data: { cy: `duplicate-live-quiz-${quiz.name}` },
      },
      {
        id: 'embeddingEvaluation',
        label: t('manage.liveQuizzes.embeddingEvaluation'),
        icon: faCode,
        onClick: () => setEmbeddingModal(true),
        data: { cy: `show-embedding-modal-${quiz.name}` },
      },
      {
        id: 'qrCode',
        label: t('manage.general.qrCode'),
        icon: faQrcode,
        onClick: () => setQRModal(true),
        data: { cy: `show-qr-modal-${quiz.name}` },
      },
      {
        id: 'editTemplate',
        label: t('manage.template.editTemplate'),
        icon: faPencil,
        onClick: () => setTemplateEditingModal(true),
        data: { cy: `edit-template-${quiz.name}` },
      },
      {
        id: 'useTemplate',
        label: t('manage.catalog.useTemplate'),
        icon: faWpforms,
        onClick: () => router.push(`/templates/${quiz.templateId}`),
        data: { cy: `use-template-${quiz.name}` },
      },
      {
        id: 'deleteTemplate',
        label: t('manage.template.deleteTemplate'),
        icon: faTrashCan,
        onClick: () => setTemplateDeletionModal(true),
        data: { cy: `delete-template-${quiz.name}` },
        className: 'border-red-600 text-red-600 hover:text-red-600',
      },
      {
        id: 'templateFromLiveQuiz',
        label: t('manage.template.convertOption'),
        icon: faFilePen,
        onClick: () =>
          setConversionModal({
            open: true,
            activityId: quiz.id,
            activityType: ActivityType.LiveQuiz,
          }),
        data: { cy: `template-from-live-quiz-${quiz.name}` },
      },
      {
        id: 'shareLiveQuiz',
        label: t('manage.liveQuizzes.shareLiveQuiz'),
        icon: faShare,
        onClick: () => setSharingModal(true),
        data: { cy: `share-live-quiz-${quiz.name}` },
      },
      {
        id: 'liveQuizAssessmentResults',
        label: t('manage.assessment.assessmentResults'),
        icon: faFileCircleCheck,
        onClick: () =>
          window.open(
            `/courses/${quiz.courseId}/assessment/liveQuiz/${quiz.id}`,
            '_blank'
          ),
        data: { cy: `live-quiz-assessment-results-${quiz.name}` },
      },
      {
        id: 'unpublishLiveQuiz',
        label: t('manage.liveQuizzes.unpublishLiveQuiz'),
        icon: faLock,
        onClick: async () => {
          await unpublishLiveQuiz({
            variables: { id: quiz.id },
            refetchQueries: [
              ...(quiz.courseId
                ? [
                    {
                      query: GetSingleCourseDocument,
                      variables: { courseId: quiz.courseId },
                    },
                  ]
                : []),
              { query: GetUserActivitiesDocument },
            ],
          })
        },
        data: { cy: `unpublish-live-quiz-${quiz.name}` },
        className: 'border-red-600 text-red-600 hover:text-red-600',
      },
      {
        id: 'removeLiveQuiz',
        label: t('manage.liveQuizzes.removeLiveQuiz'),
        icon: faX,
        onClick: () => setRemovalModal(true),
        data: { cy: `remove-live-quiz-${quiz.name}` },
        className: 'border-red-600 text-red-600 hover:text-red-600',
      },
      {
        id: 'resetLiveQuiz',
        label: t('manage.liveQuizzes.resetLiveQuiz'),
        icon: faArrowsRotate,
        onClick: () => setResetModal(true),
        data: { cy: `reset-assessment-live-quiz-${quiz.name}` },
        className: 'border-red-600 text-red-600 hover:text-red-600',
      },
      {
        id: 'deleteLiveQuiz',
        label: t('manage.liveQuizzes.deleteLiveQuiz'),
        icon: faTrashCan,
        onClick: () => setDeletionModal(true),
        data: { cy: `delete-live-quiz-${quiz.name}` },
        className: 'border-red-600 text-red-600 hover:text-red-600',
      },
      {
        id: 'activityLog',
        label: t('shared.comments.viewComments'),
        icon: faMessage,
        onClick: () => setActivityLogOpen(true),
        data: { cy: `view-activity-log-${quiz.name}` },
      },
    ],
    [
      t,
      router,
      quiz.id,
      quiz.name,
      quiz.templateId,
      onStart,
      starting,
      setEmbeddingModal,
      setQRModal,
      setTemplateEditingModal,
      setTemplateDeletionModal,
      setConversionModal,
      setSharingModal,
      setRemovalModal,
      setDeletionModal,
      setActivityLogOpen,
      quiz.courseId,
      setSchedulingModal,
      setResetModal,
      unpublishLiveQuiz,
    ]
  )

  return actions
}

export default useLiveQuizActions
