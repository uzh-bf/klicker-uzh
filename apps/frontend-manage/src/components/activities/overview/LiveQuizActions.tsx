import {
  ActivityInfo,
  ActivityType,
  PublicationStatus,
  SharingObjectType,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import EmbeddingModal from '~/components/liveQuiz/EmbeddingModal'
import ObjectSharingModalWrapper from '~/components/sharing/ObjectSharingModalWrapper'
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

function LiveQuizActions({ quiz }: { quiz: ActivityInfo }) {
  const t = useTranslations()
  const router = useRouter()

  const [embeddingModal, setEmbeddingModal] = useState(false)
  const [qrModal, setQRModal] = useState(false)
  const [deletionModal, setDeletionModal] = useState(false)
  const [removalModal, setRemovalModal] = useState(false)
  const [templateEditingModal, setTemplateEditingModal] = useState(false)
  const [templateDeletionModal, setTemplateDeletionModal] = useState(false)
  const [sharingModal, setSharingModal] = useState(false)
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
    id: quiz.id,
    name: quiz.name,
  })
  const { onDelete, deleting } = useDeleteLiveQuiz({ id: quiz.id })

  const actions = useLiveQuizActions({
    quiz,
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

  const availableActions = useAvailableActions({
    actions,
    statusActionMap,
    permissionActionMap,
    status: quiz.status,
    isEditor: quiz.isEditor,
    isExecutor: quiz.isExecutor,
    isManager: quiz.isManager,
    isOwner: quiz.isOwner,
    isRemovable: quiz.isRemovable,
    isShared: quiz.isShared,
  })

  return (
    <div>
      <ActivityActions
        availableActions={availableActions}
        activityId={quiz.id}
        activityName={quiz.name}
        activityType={ActivityType.LiveQuiz}
      />
      <div>
        {deletionModal && (
          <LiveQuizDeletionModal
            quizId={quiz.id}
            open={deletionModal}
            setOpen={setDeletionModal}
            onDelete={onDelete}
            deleting={deleting}
          />
        )}

        {templateDeletionModal && (
          <TemplateDeletionModal
            activityId={quiz.id}
            activityType={ActivityType.LiveQuiz}
            open={templateDeletionModal}
            setOpen={setTemplateDeletionModal}
            onSuccess={() => setTemplateDeletionSuccess(true)}
            onError={() => setTemplateDeletionError(true)}
          />
        )}
        {templateEditingModal && (
          <TemplateEditModal
            activityId={quiz.id}
            activityType={ActivityType.LiveQuiz}
            open={templateEditingModal}
            setOpen={setTemplateEditingModal}
            onSuccess={() => setTemplateEditSuccess(true)}
            onError={() => setTemplateEditError(true)}
          />
        )}

        {qrModal && (
          <LiveQuizQRModal
            quizId={quiz.id}
            open={qrModal}
            setOpen={setQRModal}
          />
        )}

        {embeddingModal && (
          <EmbeddingModal
            key={quiz.id}
            open={embeddingModal}
            onClose={() => setEmbeddingModal(false)}
            quizId={quiz.id}
            elements={quiz.stacks.flatMap((stack) =>
              stack.elements.map((instance) => ({
                id: instance.id,
                name: instance.name,
              }))
            )}
          />
        )}

        {sharingModal && quiz.isManager && (
          <ObjectSharingModalWrapper
            objectUuid={quiz.id}
            objectName={quiz.name}
            objectType={SharingObjectType.LiveQuiz}
            isOwner={quiz.isOwner ?? false}
            open={sharingModal}
            onClose={() => setSharingModal(false)}
          />
        )}

        {removalModal && quiz.isRemovable && (
          <ActivityRemovalModal
            activityId={quiz.id}
            activityType={ActivityType.LiveQuiz}
            title={quiz.name}
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
      </div>
    </div>
  )
}

export default LiveQuizActions
