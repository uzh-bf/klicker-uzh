import { useMutation, useQuery } from '@apollo/client'
import {
  ActivityInfo,
  ActivityType,
  DeleteLiveQuizDocument,
  GetSingleCourseDocument,
  ObjectType,
  PublicationStatus,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useMemo, useState } from 'react'
import LiveQuizDeletionModal from '../../courses/modals/LiveQuizDeletionModal'
import LiveQuizResetModal from '../../courses/modals/LiveQuizResetModal'
import LiveQuizSchedulingModal from '../../courses/modals/LiveQuizSchedulingModal'
import TemplateConversionModal from '../../courses/modals/TemplateConversionModal'
import TemplateDeletionModal from '../../courses/modals/TemplateDeletionModal'
import TemplateEditModal from '../../courses/modals/TemplateEditModal'
import LiveQuizQRModal from '../../liveQuiz/cockpit/LiveQuizQRModal'
import EmbeddingModal from '../../liveQuiz/EmbeddingModal'
import ActivityLogDialog from '../../sharing/ActivityLogDialog'
import ObjectSharingModalWrapper from '../../sharing/ObjectSharingModalWrapper'
import useAvailableActions from '../actions/useAvailableActions'
import useLiveQuizActions from '../actions/useLiveQuizActions'
import useStartLiveQuiz from '../actions/useStartLiveQuiz'
import ActivityActions from './ActivityActions'
import ActivityRemovalModal from './ActivityRemovalModal'

// create a map between the activity status and the available actions (in order)
const statusActionMap = {
  [PublicationStatus.Draft]: [
    'startLiveQuiz',
    'scheduleLiveQuiz',
    'editLiveQuiz',
    'qrCode',
    'embeddingEvaluation',
    'duplicateLiveQuiz',
    'templateFromLiveQuiz',
    'activityLog',
    'shareLiveQuiz',
    'removeLiveQuiz',
    'deleteLiveQuiz',
  ],
  [PublicationStatus.Scheduled]: [
    'startLiveQuiz',
    'duplicateLiveQuiz',
    'qrCode',
    'embeddingEvaluation',
    'activityLog',
    'shareLiveQuiz',
    'unpublishLiveQuiz',
    'removeLiveQuiz',
    'deleteLiveQuiz',
  ],
  [PublicationStatus.Published]: [
    'lecturerCockpit',
    'liveQuizEvaluation',
    'qrCode',
    'embeddingEvaluation',
    'duplicateLiveQuiz',
    'activityLog',
    'shareLiveQuiz',
    'liveQuizAssessmentResults',
    'removeLiveQuiz',
  ],
  [PublicationStatus.Ended]: [
    'liveQuizEvaluation',
    'duplicateLiveQuiz',
    'embeddingEvaluation',
    'activityLog',
    'shareLiveQuiz',
    'liveQuizAssessmentResults',
    'removeLiveQuiz',
    'resetLiveQuiz',
    'deleteLiveQuiz',
  ],
  [PublicationStatus.Template]: [
    'editTemplate',
    'useTemplate',
    'deleteTemplate',
  ],
  [PublicationStatus.Graded]: [],
}

function LiveQuizActions({
  liveQuiz,
  isTemplate,
  sharingModal,
  setSharingModal,
  setShowDetails,
  refetchActivities,
}: {
  liveQuiz: ActivityInfo
  isTemplate: boolean
  sharingModal: boolean
  setSharingModal: Dispatch<SetStateAction<boolean>>
  setShowDetails: Dispatch<SetStateAction<boolean>>
  refetchActivities?: () => Promise<void>
}) {
  const t = useTranslations()
  const [activityLogOpen, setActivityLogOpen] = useState(false)
  const [schedulingModal, setSchedulingModal] = useState(false)
  const [embeddingModal, setEmbeddingModal] = useState(false)
  const [qrModal, setQRModal] = useState(false)
  const [deletionModal, setDeletionModal] = useState(false)
  const [resetModal, setResetModal] = useState(false)
  const [removalModal, setRemovalModal] = useState(false)
  const [templateEditingModal, setTemplateEditingModal] = useState(false)
  const [templateDeletionModal, setTemplateDeletionModal] = useState(false)
  const [conversionModal, setConversionModal] = useState<{
    open: boolean
    activityId: string
    activityType: ActivityType
  }>({ open: false, activityId: '', activityType: ActivityType.LiveQuiz })

  const { onStart, starting } = useStartLiveQuiz({
    id: liveQuiz.id,
    name: liveQuiz.name,
  })

  const [deleteLiveQuiz, { loading: deleting }] = useMutation(
    DeleteLiveQuizDocument,
    {
      variables: { id: liveQuiz.id },
      update: (cache, { data: res }) => {
        // if the live quiz is not part of a course or the mutation was not successful, return early
        if (!liveQuiz.courseId || !res?.deleteLiveQuiz?.id) return

        // change the status of the live quiz on the course overview back to draft
        cache.updateQuery(
          {
            query: GetSingleCourseDocument,
            variables: { courseId: liveQuiz.courseId! },
          },
          (data) => {
            if (!data?.course) return data

            return {
              course: {
                ...data.course,
                liveQuizzesInfo:
                  data.course.liveQuizzesInfo?.filter(
                    (lq) => lq.id !== res.deleteLiveQuiz!.id
                  ) ?? [],
              },
            }
          }
        )
      },
    }
  )
  const { data: dataUser } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-only',
  })
  const user = dataUser?.userProfile

  // limit the available actions based on the permission level (order irrelevant - lower levels automatically included)
  const permissionActionMap = useMemo(() => {
    return {
      isManager: [
        'duplicateLiveQuiz',
        ...(user?.privatePreview
          ? ['templateFromLiveQuiz', 'shareLiveQuiz']
          : []),
        // the results of assessment live quizzes can be inspected in more detail
        ...(liveQuiz.isActivityReviewer && liveQuiz.isAssessmentEnabled
          ? ['liveQuizAssessmentResults']
          : []),
        // assessment live quizzes can only be deleted when not completed and only by course admins
        ...(!liveQuiz.isAssessmentEnabled
          ? ['deleteLiveQuiz']
          : liveQuiz.isActivityReviewer &&
              (liveQuiz.status === PublicationStatus.Draft ||
                liveQuiz.status === PublicationStatus.Scheduled)
            ? ['deleteLiveQuiz']
            : []),
        // regular live quizzes can be reset by managers; completed assessment
        // live quizzes retain the additional assessment reviewer restriction
        ...(!liveQuiz.isAssessmentEnabled || liveQuiz.isActivityReviewer
          ? ['resetLiveQuiz']
          : []),
        'deleteTemplate',
      ],
      isEditor: ['editLiveQuiz', 'editTemplate'],
      isExecutor: [
        'startLiveQuiz',
        'scheduleLiveQuiz',
        'unpublishLiveQuiz',
        'lecturerCockpit',
      ],
      isShared: [
        'qrCode',
        'embeddingEvaluation',
        'liveQuizEvaluation',
        'useTemplate',
        'activityLog',
      ],
      isRemovable: ['removeLiveQuiz'],
    }
  }, [
    user?.privatePreview,
    liveQuiz.id,
    liveQuiz.status,
    liveQuiz.isAssessmentEnabled,
    liveQuiz.isActivityReviewer,
  ])

  const actions = useLiveQuizActions({
    quiz: liveQuiz,
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
  })

  // get all available actions based on permissions and status
  const availableActions = useAvailableActions({
    actions,
    statusActionMap,
    permissionActionMap,
    status: liveQuiz.status,
    isEditor: liveQuiz.isEditor,
    isExecutor: liveQuiz.isExecutor,
    isManager: liveQuiz.isManager,
    isOwner: liveQuiz.isOwner,
    isRemovable: liveQuiz.isRemovable,
    isShared: liveQuiz.isShared,
  })

  return (
    <div>
      <ActivityActions
        availableActions={availableActions}
        activityId={liveQuiz.id}
        activityName={liveQuiz.name}
        activityType={liveQuiz.type}
        openActivityDetailsModal={() => setShowDetails(true)}
      />
      <div>
        {schedulingModal && (
          <LiveQuizSchedulingModal
            activityId={liveQuiz.id}
            title={liveQuiz.name}
            courseId={liveQuiz.courseId}
            courseStartDate={liveQuiz.courseStartDate}
            onClose={() => setSchedulingModal(false)}
          />
        )}

        {deletionModal && (
          <LiveQuizDeletionModal
            quizId={liveQuiz.id}
            onClose={() => setDeletionModal(false)}
            onDelete={async () => {
              await deleteLiveQuiz()
              await refetchActivities?.()
            }}
            deleting={deleting}
          />
        )}

        {resetModal && (
          <LiveQuizResetModal
            quizId={liveQuiz.id}
            courseId={liveQuiz.courseId}
            onClose={() => setResetModal(false)}
            onSuccess={async () => {
              await refetchActivities?.()
            }}
          />
        )}

        {templateDeletionModal && (
          <TemplateDeletionModal
            activityId={liveQuiz.id}
            activityType={ActivityType.LiveQuiz}
            courseId={liveQuiz.courseId}
            onClose={() => setTemplateDeletionModal(false)}
            onSuccess={() =>
              toast({
                type: 'success',
                message: t('manage.template.templateDeletionSuccess'),
                options: { duration: 3000 },
              })
            }
            onError={() =>
              toast({
                type: 'error',
                message: t('manage.template.templateDeletionError'),
                options: { duration: 4500 },
              })
            }
            refetchActivities={refetchActivities}
          />
        )}
        {templateEditingModal && (
          <TemplateEditModal
            activityId={liveQuiz.id}
            activityType={ActivityType.LiveQuiz}
            onClose={() => setTemplateEditingModal(false)}
            onSuccess={() =>
              toast({
                type: 'success',
                message: t('manage.template.templateEditSuccess'),
                options: { duration: 3000 },
              })
            }
            onError={() =>
              toast({
                type: 'error',
                message: t('manage.template.templateEditError'),
                options: { duration: 4500 },
              })
            }
            refetchActivities={refetchActivities}
          />
        )}

        {qrModal && (
          <LiveQuizQRModal
            quizId={liveQuiz.id}
            quizPin={liveQuiz.pinCode}
            isAssessmentEnabled={liveQuiz.isAssessmentEnabled ?? false}
            language={liveQuiz.courseLanguage}
            onClose={() => setQRModal(false)}
          />
        )}

        {embeddingModal && (
          <EmbeddingModal
            key={liveQuiz.id}
            onClose={() => setEmbeddingModal(false)}
            quizId={liveQuiz.id}
            isGamificationEnabled={liveQuiz.isGamificationEnabled ?? false}
          />
        )}

        {sharingModal && liveQuiz.isManager ? (
          <ObjectSharingModalWrapper
            objectUuid={liveQuiz.id}
            objectName={liveQuiz.name}
            objectType={ObjectType.LiveQuiz}
            isTemplate={isTemplate}
            onClose={() => setSharingModal(false)}
            refetchActivities={refetchActivities}
          />
        ) : null}

        {removalModal && liveQuiz.isRemovable && (
          <ActivityRemovalModal
            activityId={liveQuiz.id}
            activityType={ActivityType.LiveQuiz}
            title={liveQuiz.name}
            isModalOpen={removalModal}
            setModalOpen={setRemovalModal}
            refetchActivities={refetchActivities}
          />
        )}

        {conversionModal.open && (
          <TemplateConversionModal
            onClose={() =>
              setConversionModal((prev) => ({ ...prev, open: false }))
            }
            activityId={conversionModal.activityId}
            activityType={conversionModal.activityType}
            onSuccess={() =>
              toast({
                type: 'success',
                message: t('manage.template.templateCreationSuccess'),
                options: { duration: 3500 },
              })
            }
            onError={() =>
              toast({
                type: 'error',
                message: t('manage.template.templateCreationError'),
              })
            }
            refetchActivities={refetchActivities}
          />
        )}

        {liveQuiz && activityLogOpen ? (
          <ActivityLogDialog
            objectId={liveQuiz.id}
            objectType={ObjectType.LiveQuiz}
            open={activityLogOpen}
            onClose={() => setActivityLogOpen(false)}
          />
        ) : null}
      </div>
    </div>
  )
}

export default LiveQuizActions
