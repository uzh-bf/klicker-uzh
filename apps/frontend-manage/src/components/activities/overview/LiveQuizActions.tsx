import { useQuery } from '@apollo/client'
import {
  ActivityInfo,
  ActivityType,
  ObjectType,
  PublicationStatus,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useMemo, useState } from 'react'
import LiveQuizDeletionModal from '../../courses/modals/LiveQuizDeletionModal'
import TemplateConversionModal from '../../courses/modals/TemplateConversionModal'
import TemplateDeletionModal from '../../courses/modals/TemplateDeletionModal'
import TemplateEditModal from '../../courses/modals/TemplateEditModal'
import LiveQuizQRModal from '../../liveQuiz/cockpit/LiveQuizQRModal'
import EmbeddingModal from '../../liveQuiz/EmbeddingModal'
import ActivityLogDialog from '../../sharing/ActivityLogDialog'
import ObjectSharingModalWrapper from '../../sharing/ObjectSharingModalWrapper'
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
    'removeLiveQuiz',
  ],
  [PublicationStatus.Ended]: [
    'liveQuizEvaluation',
    'duplicateLiveQuiz',
    'embeddingEvaluation',
    'activityLog',
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

  const { data: dataUser } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-only',
  })
  const user = dataUser?.userProfile

  // limit the available actions based on the permission level (order irrelevant - lower levels automatically included)
  const permissionActionMap = useMemo(() => {
    return {
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
        ...(user?.privatePreview ? ['activityLog'] : []),
      ],
      isRemovable: ['removeLiveQuiz'],
    }
  }, [user?.privatePreview])

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
    setActivityLogOpen,
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
      />
      <div>
        {deletionModal && (
          <LiveQuizDeletionModal
            quizId={liveQuiz.id}
            onClose={() => setDeletionModal(false)}
            onDelete={onDelete}
            deleting={deleting}
          />
        )}

        {templateDeletionModal && (
          <TemplateDeletionModal
            activityId={liveQuiz.id}
            activityType={ActivityType.LiveQuiz}
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
          />
        )}

        {qrModal && (
          <LiveQuizQRModal
            quizId={liveQuiz.id}
            onClose={() => setQRModal(false)}
          />
        )}

        {embeddingModal && (
          <EmbeddingModal
            key={liveQuiz.id}
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

        {sharingModal && liveQuiz.isManager ? (
          <ObjectSharingModalWrapper
            objectUuid={liveQuiz.id}
            objectName={liveQuiz.name}
            objectType={ObjectType.LiveQuiz}
            isTemplate={isTemplate}
            isOwner={liveQuiz.isOwner ?? false}
            onClose={() => setSharingModal(false)}
          />
        ) : null}

        {removalModal && liveQuiz.isRemovable && (
          <ActivityRemovalModal
            activityId={liveQuiz.id}
            activityType={ActivityType.LiveQuiz}
            title={liveQuiz.name}
            isModalOpen={removalModal}
            setModalOpen={setRemovalModal}
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
