import { useQuery } from '@apollo/client'
import {
  type ActivityInfo,
  ActivityType,
  ElementInstanceType,
  ObjectType,
  PublicationStatus,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { type Dispatch, type SetStateAction, useMemo, useState } from 'react'
import ExtensionModal from '../../courses/modals/ExtensionModal'
import MicroLearningDeletionModal from '../../courses/modals/MicroLearningDeletionModal'
import MicroLearningEndingModal from '../../courses/modals/MicroLearningEndingModal'
import PublishConfirmationModal from '../../courses/modals/PublishConfirmationModal'
import ActivityLogDialog from '../../sharing/ActivityLogDialog'
import ObjectSharingModalWrapper from '../../sharing/ObjectSharingModalWrapper'
import useAvailableActions from '../actions/useAvailableActions'
import useMicroLearningActions from '../actions/useMicroLearningActions'
import ActivityActions from './ActivityActions'
import ActivityRemovalModal from './ActivityRemovalModal'

// create a map between the activity status and the available actions (in order)
const statusActionMap = {
  [PublicationStatus.Draft]: [
    'publishMicroLearning',
    'editMicroLearning',
    'openPreview',
    'copyAccessLink',
    'copyLTIAccessLink',
    'duplicateMicroLearning',
    'activityLog',
    'shareMicroLearning',
    'removeMicroLearning',
    'deleteMicroLearning',
  ],
  [PublicationStatus.Scheduled]: [
    'copyAccessLink',
    'openPreview',
    'copyLTIAccessLink',
    'duplicateMicroLearning',
    'activityLog',
    'shareMicroLearning',
    'unpublishMicrolearning',
    'removeMicroLearning',
    'deleteMicroLearning',
  ],
  [PublicationStatus.Published]: [
    'copyAccessLink',
    'openEvaluation',
    'endMicroLearning',
    'extendMicroLearning',
    'openPreview',
    'copyLTIAccessLink',
    'duplicateMicroLearning',
    'activityLog',
    'shareMicroLearning',
    'removeMicroLearning',
    'deleteMicroLearning',
  ],
  [PublicationStatus.Ended]: [
    'openEvaluation',
    'duplicateMicroLearning',
    'convertToPracticeQuiz',
    'openPreview',
    'activityLog',
    'shareMicroLearning',
    'removeMicroLearning',
    'deleteMicroLearning',
  ],
  [PublicationStatus.Template]: [],
  [PublicationStatus.Graded]: [],
}

function MicrolearningActions({
  microLearning,
  isTemplate,
  sharingModal,
  setSharingModal,
  setShowDetails,
  refetchActivities,
}: {
  microLearning: ActivityInfo
  isTemplate: boolean
  sharingModal: boolean
  setSharingModal: Dispatch<SetStateAction<boolean>>
  setShowDetails: Dispatch<SetStateAction<boolean>>
  refetchActivities?: () => Promise<void>
}) {
  const t = useTranslations()
  const [publishModal, setPublishModal] = useState(false)
  const [deletionModal, setDeletionModal] = useState(false)
  const [endingModal, setEndingModal] = useState(false)
  const [extensionModal, setExtensionModal] = useState(false)
  const [removalModal, setRemovalModal] = useState(false)
  const [activityLogOpen, setActivityLogOpen] = useState(false)

  const { data: dataUser } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-only',
  })
  const user = dataUser?.userProfile

  // limit the available actions based on the permission level (order irrelevant - lower levels automatically included)
  const permissionActionMap = useMemo(
    () => ({
      isManager: [
        'duplicateMicroLearning',
        'convertToPracticeQuiz',
        'deleteMicroLearning',
        ...(user?.privatePreview ? ['shareMicroLearning'] : []),
      ],
      isEditor: ['editMicroLearning'],
      isExecutor: [
        'publishMicroLearning',
        'extendMicroLearning',
        'endMicroLearning',
        'unpublishMicrolearning',
      ],
      isShared: [
        'copyAccessLink',
        'copyLTIAccessLink',
        'openPreview',
        'openEvaluation',
        'activityLog',
      ],
      isRemovable: ['removeMicroLearning'],
    }),
    [user?.privatePreview]
  )

  const actions = useMicroLearningActions({
    microLearning,
    setPublishModal,
    setRemovalModal,
    setDeletionModal,
    setEndingModal,
    setExtensionModal,
    setSharingModal,
    setActivityLogOpen,
    refetchActivities,
  })

  const availableActions = useAvailableActions({
    actions,
    statusActionMap,
    permissionActionMap,
    status: microLearning.status,
    isEditor: microLearning.isEditor,
    isExecutor: microLearning.isExecutor,
    isManager: microLearning.isManager,
    isOwner: microLearning.isOwner,
    isRemovable: microLearning.isRemovable,
    isShared: microLearning.isShared,
  })

  return (
    <div>
      <ActivityActions
        availableActions={availableActions}
        activityId={microLearning.id}
        activityName={microLearning.name}
        activityType={microLearning.type}
        openActivityDetailsModal={() => setShowDetails(true)}
      />
      <div>
        {sharingModal && microLearning.isManager ? (
          <ObjectSharingModalWrapper
            objectUuid={microLearning.id}
            objectName={microLearning.name}
            objectType={ObjectType.MicroLearning}
            isTemplate={isTemplate}
            onClose={() => setSharingModal(false)}
            refetchActivities={refetchActivities}
          />
        ) : null}
        {publishModal && (
          <PublishConfirmationModal
            onClose={() => setPublishModal(false)}
            activityType={ElementInstanceType.Microlearning}
            activityId={microLearning.id}
            startAt={microLearning.scheduledStartAt}
            endAt={microLearning.scheduledEndAt}
            title={microLearning.name}
            courseId={microLearning.courseId!}
            refetchActivities={refetchActivities}
          />
        )}

        {removalModal && microLearning.isRemovable && (
          <ActivityRemovalModal
            activityId={microLearning.id}
            activityType={ActivityType.MicroLearning}
            title={microLearning.name}
            isModalOpen={removalModal}
            setModalOpen={setRemovalModal}
            refetchActivities={refetchActivities}
          />
        )}
        {deletionModal && (
          <MicroLearningDeletionModal
            onClose={() => setDeletionModal(false)}
            activityId={microLearning.id}
            courseId={microLearning.courseId!}
            refetchActivities={refetchActivities}
          />
        )}

        {endingModal && (
          <MicroLearningEndingModal
            onClose={() => setEndingModal(false)}
            activityId={microLearning.id}
            courseId={microLearning.courseId!}
            refetchActivities={refetchActivities}
          />
        )}
        {extensionModal && (
          <ExtensionModal
            type="microLearning"
            id={microLearning.id}
            currentEndDate={microLearning.scheduledEndAt}
            courseId={microLearning.courseId!}
            title={t('manage.course.extendMicroLearning')}
            description={t('manage.course.extendMicroLearningDescription')}
            onClose={() => setExtensionModal(false)}
            refetchActivities={refetchActivities}
          />
        )}

        {microLearning && activityLogOpen ? (
          <ActivityLogDialog
            objectId={microLearning.id}
            objectType={ObjectType.MicroLearning}
            open={activityLogOpen}
            onClose={() => setActivityLogOpen(false)}
          />
        ) : null}
      </div>
    </div>
  )
}

export default MicrolearningActions
