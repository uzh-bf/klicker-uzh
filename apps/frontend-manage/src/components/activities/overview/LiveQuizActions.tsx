import {
  ActivityInfo,
  ActivityType,
  ObjectType,
  PublicationStatus,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useState } from 'react'
import LiveQuizDeletionModal from '../../courses/modals/LiveQuizDeletionModal'
import TemplateConversionModal from '../../courses/modals/TemplateConversionModal'
import TemplateCreationErrorToast from '../../courses/modals/TemplateCreationErrorToast'
import TemplateCreationSuccessToast from '../../courses/modals/TemplateCreationSuccessToast'
import TemplateDeletionErrorToast from '../../courses/modals/TemplateDeletionErrorToast'
import TemplateDeletionModal from '../../courses/modals/TemplateDeletionModal'
import TemplateDeletionSuccessToast from '../../courses/modals/TemplateDeletionSuccessToast'
import TemplateEditErrorToast from '../../courses/modals/TemplateEditErrorToast'
import TemplateEditModal from '../../courses/modals/TemplateEditModal'
import TemplateEditSuccessToast from '../../courses/modals/TemplateEditSuccessToast'
import LiveQuizQRModal from '../../liveQuiz/cockpit/LiveQuizQRModal'
import EmbeddingModal from '../../liveQuiz/EmbeddingModal'
import ActivityLogDialog from '../../sharing/ActivityLogDialog'
import ObjectSharingModalWrapper from '../../sharing/ObjectSharingModalWrapper'
import useActivityLogAction from '../actions/useActivityLogAction'
import useAvailableActions from '../actions/useAvailableActions'
import useDeleteLiveQuiz from '../actions/useDeleteLiveQuiz'
import useLiveQuizActions from '../actions/useLiveQuizActions'
import useStartLiveQuiz from '../actions/useStartLiveQuiz'
import ActivityActions from './ActivityActions'
import ActivityRemovalModal from './ActivityRemovalModal'

// create a map between the activity status and the available actions (in order)
const statusActionMap = {
  [PublicationStatus.Draft]: [
    'startLiveQuiz',
    'editLiveQuiz',
    'qrCode',
    'embeddingEvaluation',
    'duplicateLiveQuiz',
    'templateFromLiveQuiz',
    'shareLiveQuiz',
    'removeLiveQuiz',
    'deleteLiveQuiz',
  ],
  [PublicationStatus.Scheduled]: [
    'startLiveQuiz',
    'duplicateLiveQuiz',
    'qrCode',
    'embeddingEvaluation',
    'shareLiveQuiz',
    'removeLiveQuiz',
    'deleteLiveQuiz',
  ],
  [PublicationStatus.Published]: [
    'lecturerCockpit',
    'liveQuizEvaluation',
    'qrCode',
    'embeddingEvaluation',
    'duplicateLiveQuiz',
    'shareLiveQuiz',
    'removeLiveQuiz',
  ],
  [PublicationStatus.Ended]: [
    'liveQuizEvaluation',
    'duplicateLiveQuiz',
    'embeddingEvaluation',
    'shareLiveQuiz',
    'removeLiveQuiz',
    'deleteLiveQuiz',
  ],
  [PublicationStatus.Template]: [
    'editTemplate',
    'useTemplate',
    'deleteTemplate',
  ],
  [PublicationStatus.Graded]: [],
}

// limit the available actions based on the permission level (order irrelevant - lower levels automatically included)
const permissionActionMap = {
  isManager: [
    'duplicateLiveQuiz',
    'templateFromLiveQuiz',
    'shareLiveQuiz',
    'deleteLiveQuiz',
    'deleteTemplate',
  ],
  isEditor: ['editLiveQuiz', 'editTemplate'],
  isExecutor: ['startLiveQuiz', 'lecturerCockpit'],
  isShared: [
    'qrCode',
    'embeddingEvaluation',
    'liveQuizEvaluation',
    'useTemplate',
  ],
  isRemovable: ['removeLiveQuiz'],
}

function LiveQuizActions({
  liveQuiz,
  isTemplate,
  sharingModal,
  setSharingModal,
}: {
  liveQuiz: ActivityInfo
  isTemplate: boolean
  sharingModal: boolean
  setSharingModal: Dispatch<SetStateAction<boolean>>
}) {
  const t = useTranslations()

  const [activityLogOpen, setActivityLogOpen] = useState(false)
  const [embeddingModal, setEmbeddingModal] = useState(false)
  const [qrModal, setQRModal] = useState(false)
  const [deletionModal, setDeletionModal] = useState(false)
  const [removalModal, setRemovalModal] = useState(false)
  const [templateEditingModal, setTemplateEditingModal] = useState(false)
  const [templateDeletionModal, setTemplateDeletionModal] = useState(false)
  const [templateCreationSuccess, setTemplateCreationSuccess] = useState(false)
  const [templateCreationError, setTemplateCreationError] = useState(false)
  const [templateEditSuccess, setTemplateEditSuccess] = useState(false)
  const [templateEditError, setTemplateEditError] = useState(false)
  const [templateDeletionSuccess, setTemplateDeletionSuccess] = useState(false)
  const [templateDeletionError, setTemplateDeletionError] = useState(false)
  const [conversionModal, setConversionModal] = useState<{
    open: boolean
    activityId: string
    activityType: ActivityType
  }>({ open: false, activityId: '', activityType: ActivityType.LiveQuiz })

  const { onStart, starting } = useStartLiveQuiz({
    id: liveQuiz.id,
    name: liveQuiz.name,
  })
  const { onDelete, deleting } = useDeleteLiveQuiz({ id: liveQuiz.id })

  // Create activity log action
  const activityLogAction = useActivityLogAction({
    objectId: liveQuiz.id,
    objectType: ObjectType.LiveQuiz,
    setActivityLogOpen,
  })

  const actions = useLiveQuizActions({
    quiz: liveQuiz,
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
  })

  // Get all available actions based on permissions and status
  const baseActions = useAvailableActions({
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

  // Add activity log action at the beginning of the dropdown, leaving the first 3 buttons unchanged
  const visibleActions = baseActions.slice(0, 3)
  const dropdownActions = [activityLogAction, ...baseActions.slice(3)]
  const availableActions = [...visibleActions, ...dropdownActions]

  return (
    <div>
      <ActivityActions
        availableActions={availableActions}
        activityId={liveQuiz.id}
        activityName={liveQuiz.name}
        activityType={liveQuiz.type}
      />
      <div>
        {deletionModal && (
          <LiveQuizDeletionModal
            quizId={liveQuiz.id}
            open={deletionModal}
            setOpen={setDeletionModal}
            onDelete={onDelete}
            deleting={deleting}
          />
        )}

        {templateDeletionModal && (
          <TemplateDeletionModal
            activityId={liveQuiz.id}
            activityType={ActivityType.LiveQuiz}
            open={templateDeletionModal}
            setOpen={setTemplateDeletionModal}
            onSuccess={() => setTemplateDeletionSuccess(true)}
            onError={() => setTemplateDeletionError(true)}
          />
        )}
        {templateEditingModal && (
          <TemplateEditModal
            activityId={liveQuiz.id}
            activityType={ActivityType.LiveQuiz}
            open={templateEditingModal}
            setOpen={setTemplateEditingModal}
            onSuccess={() => setTemplateEditSuccess(true)}
            onError={() => setTemplateEditError(true)}
          />
        )}

        {qrModal && (
          <LiveQuizQRModal
            quizId={liveQuiz.id}
            open={qrModal}
            setOpen={setQRModal}
          />
        )}

        {embeddingModal && (
          <EmbeddingModal
            key={liveQuiz.id}
            open={embeddingModal}
            onClose={() => setEmbeddingModal(false)}
            quizId={liveQuiz.id}
            elements={liveQuiz.stacks.flatMap((stack) =>
              stack.elements.map((instance) => ({
                id: instance.id,
                name: instance.name,
              }))
            )}
          />
        )}

        {sharingModal && liveQuiz.isManager && (
          <ObjectSharingModalWrapper
            objectUuid={liveQuiz.id}
            objectName={liveQuiz.name}
            objectType={ObjectType.LiveQuiz}
            isTemplate={isTemplate}
            isOwner={liveQuiz.isOwner ?? false}
            open={sharingModal}
            onClose={() => setSharingModal(false)}
          />
        )}

        {removalModal && liveQuiz.isRemovable && (
          <ActivityRemovalModal
            activityId={liveQuiz.id}
            activityType={ActivityType.LiveQuiz}
            title={liveQuiz.name}
            isModalOpen={removalModal}
            setModalOpen={setRemovalModal}
          />
        )}

        <TemplateConversionModal
          open={conversionModal.open}
          setOpen={(open) => setConversionModal({ ...conversionModal, open })}
          activityId={conversionModal.activityId}
          activityType={conversionModal.activityType}
          onSuccess={() => setTemplateCreationSuccess(true)}
          onError={() => setTemplateCreationError(true)}
        />
        <TemplateCreationSuccessToast
          open={templateCreationSuccess}
          onClose={() => setTemplateCreationSuccess(false)}
        />
        <TemplateCreationErrorToast
          open={templateCreationError}
          onClose={() => setTemplateCreationError(false)}
        />
        <TemplateEditSuccessToast
          open={templateEditSuccess}
          onClose={() => setTemplateEditSuccess(false)}
        />
        <TemplateEditErrorToast
          open={templateEditError}
          onClose={() => setTemplateEditError(false)}
        />
        <TemplateDeletionSuccessToast
          open={templateDeletionSuccess}
          onClose={() => setTemplateDeletionSuccess(false)}
        />
        <TemplateDeletionErrorToast
          open={templateDeletionError}
          onClose={() => setTemplateDeletionError(false)}
        />

        {liveQuiz && (
          <ActivityLogDialog
            objectId={liveQuiz.id}
            objectType={ObjectType.LiveQuiz}
            trigger={<></>}
            open={activityLogOpen}
            onOpenChange={setActivityLogOpen}
          />
        )}
      </div>
    </div>
  )
}

export default LiveQuizActions
