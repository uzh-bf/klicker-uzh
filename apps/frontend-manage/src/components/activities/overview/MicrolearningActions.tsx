import { useQuery } from '@apollo/client'
import {
  ActivityInfo,
  ElementInstanceType,
  PublicationStatus,
  SharingObjectType,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import ExtensionModal from '../../courses/modals/ExtensionModal'
import MicroLearningDeletionModal from '../../courses/modals/MicroLearningDeletionModal'
import MicroLearningEndingModal from '../../courses/modals/MicroLearningEndingModal'
import PublishConfirmationModal from '../../courses/modals/PublishConfirmationModal'
import ObjectSharingModalWrapper from '../../sharing/ObjectSharingModalWrapper'
import CopyConfirmationToast from '../../toasts/CopyConfirmationToast'
import useAvailableActions from '../actions/useAvailableActions'
import useMicroLearningActions from '../actions/useMicroLearningActions'
import ActivityActions from './ActivityActions'

// create a map between the activity status and the available actions (in order)
const statusActionMap = {
  [PublicationStatus.Draft]: [
    'publishMicroLearning',
    'editMicroLearning',
    'openPreview',
    'copyAccessLink',
    'copyLTIAccessLink',
    'duplicateMicroLearning',
    'shareMicroLearning',
    'deleteMicroLearning',
  ],
  [PublicationStatus.Scheduled]: [
    'copyAccessLink',
    'openPreview',
    'copyLTIAccessLink',
    'duplicateMicroLearning',
    'shareMicroLearning',
    'unpublishMicrolearning',
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
    'analyticsMicroLearning',
    'shareMicroLearning',
    'deleteMicroLearning',
  ],
  [PublicationStatus.Ended]: [
    'openEvaluation',
    'duplicateMicroLearning',
    'convertToPracticeQuiz',
    'analyticsMicroLearning',
    'openPreview',
    'shareMicroLearning',
    'deleteMicroLearning',
  ],
  [PublicationStatus.Template]: [],
  [PublicationStatus.Graded]: [],
}

function MicrolearningActions({
  microLearning,
}: {
  microLearning: ActivityInfo
}) {
  const t = useTranslations()
  const [publishModal, setPublishModal] = useState(false)
  const [copyToast, setCopyToast] = useState(false)
  const [deletionModal, setDeletionModal] = useState(false)
  const [endingModal, setEndingModal] = useState(false)
  const [extensionModal, setExtensionModal] = useState(false)
  const [sharingModal, setSharingModal] = useState(false)

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
        'shareMicroLearning',
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
        ...(user?.publicPreview ? ['analyticsMicroLearning'] : []),
      ],
      isRemovable: [],
    }),
    [user?.publicPreview]
  )

  const actions = useMicroLearningActions({
    microLearning,
    setCopyToast,
    setPublishModal,
    setDeletionModal,
    setEndingModal,
    setExtensionModal,
    setSharingModal,
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
      />
      <div>
        {sharingModal && microLearning.isManager && (
          <ObjectSharingModalWrapper
            objectUuid={microLearning.id}
            objectName={microLearning.name}
            objectType={SharingObjectType.MicroLearning}
            isOwner={microLearning.isOwner ?? false}
            open={sharingModal}
            onClose={() => setSharingModal(false)}
          />
        )}
        {publishModal && (
          <PublishConfirmationModal
            open={publishModal}
            setOpen={setPublishModal}
            elementType={ElementInstanceType.Microlearning}
            elementId={microLearning.id}
            title={microLearning.name}
            courseId={microLearning.courseId!}
            publicationHint={t('manage.course.microPublishingHint')}
          />
        )}
        {deletionModal && (
          <MicroLearningDeletionModal
            open={deletionModal}
            setOpen={setDeletionModal}
            activityId={microLearning.id}
            courseId={microLearning.courseId!}
          />
        )}
        {endingModal && (
          <MicroLearningEndingModal
            open={endingModal}
            setOpen={setEndingModal}
            activityId={microLearning.id}
            courseId={microLearning.courseId!}
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
            open={extensionModal}
            setOpen={setExtensionModal}
          />
        )}

        <CopyConfirmationToast open={copyToast} setOpen={setCopyToast} />
      </div>
    </div>
  )
}

export default MicrolearningActions
