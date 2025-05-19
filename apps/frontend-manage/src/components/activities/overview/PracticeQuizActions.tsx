import { useQuery } from '@apollo/client'
import {
  ActivityInfo,
  ActivityType,
  ObjectType,
  PublicationStatus,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Dispatch, SetStateAction, useMemo, useState } from 'react'
import PracticeQuizDeletionModal from '../../courses/modals/PracticeQuizDeletionModal'
import PracticeQuizPublishingModal from '../../courses/modals/PracticeQuizPublishingModal'
import ActivityLogDialog from '../../sharing/ActivityLogDialog'
import ObjectSharingModalWrapper from '../../sharing/ObjectSharingModalWrapper'
import CopyConfirmationToast from '../../toasts/CopyConfirmationToast'
import useAvailableActions from '../actions/useAvailableActions'
import usePracticeQuizActions from '../actions/usePracticeQuizActions'
import ActivityActions from './ActivityActions'
import ActivityRemovalModal from './ActivityRemovalModal'

// create a map between the activity status and the available actions (in order)
const statusActionMap = {
  [PublicationStatus.Draft]: [
    'publishPracticeQuiz',
    'editPracticeQuiz',
    'openPreview',
    'copyAccessLink',
    'copyLTIAccessLink',
    'duplicatePracticeQuiz',
    'activityLog',
    'sharePracticeQuiz',
    'removePracticeQuiz',
    'deletePracticeQuiz',
  ],
  [PublicationStatus.Scheduled]: [
    'copyAccessLink',
    'openPreview',
    'copyLTIAccessLink',
    'duplicatePracticeQuiz',
    'activityLog',
    'sharePracticeQuiz',
    'unpublishPracticeQuiz',
    'removePracticeQuiz',
    'deletePracticeQuiz',
  ],
  [PublicationStatus.Published]: [
    'openEvaluation',
    'copyAccessLink',
    'openPreview',
    'copyLTIAccessLink',
    'duplicatePracticeQuiz',
    'analyticsPracticeQuiz',
    'activityLog',
    'sharePracticeQuiz',
    'removePracticeQuiz',
    'deletePracticeQuiz',
  ],
  [PublicationStatus.Ended]: [],
  [PublicationStatus.Template]: [],
  [PublicationStatus.Graded]: [],
}

function PracticeQuizActions({
  practiceQuiz,
  isTemplate,
  sharingModal,
  setSharingModal,
}: {
  practiceQuiz: ActivityInfo
  isTemplate: boolean
  sharingModal: boolean
  setSharingModal: Dispatch<SetStateAction<boolean>>
}) {
  const [publishModal, setPublishModal] = useState(false)
  const [deletionModal, setDeletionModal] = useState(false)
  const [removalModal, setRemovalModal] = useState(false)
  const [copyToast, setCopyToast] = useState(false)
  const [activityLogOpen, setActivityLogOpen] = useState(false)

  const { data: dataUser } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-only',
  })
  const user = dataUser?.userProfile

  // limit the available actions based on the permission level (order irrelevant - lower levels automatically included)
  const permissionActionMap = useMemo(
    () => ({
      isManager: [
        'duplicatePracticeQuiz',
        'sharePracticeQuiz',
        'deletePracticeQuiz',
      ],
      isEditor: ['editPracticeQuiz'],
      isExecutor: ['publishPracticeQuiz', 'unpublishPracticeQuiz'],
      isShared: [
        'copyAccessLink',
        'copyLTIAccessLink',
        'openPreview',
        'openEvaluation',
        ...(user?.publicPreview ? ['analyticsPracticeQuiz'] : []),
        ...(user?.privatePreview ? ['activityLog'] : []),
      ],
      isRemovable: ['removePracticeQuiz'],
    }),
    [user?.publicPreview, user?.privatePreview]
  )

  const actions = usePracticeQuizActions({
    practiceQuiz,
    setPublishModal,
    setDeletionModal,
    setSharingModal,
    setRemovalModal,
    setCopyToast,
    setActivityLogOpen,
  })

  const availableActions = useAvailableActions({
    actions,
    statusActionMap,
    permissionActionMap,
    status: practiceQuiz.status,
    isEditor: practiceQuiz.isEditor,
    isExecutor: practiceQuiz.isExecutor,
    isManager: practiceQuiz.isManager,
    isOwner: practiceQuiz.isOwner,
    isRemovable: practiceQuiz.isRemovable,
    isShared: practiceQuiz.isShared,
  })

  return (
    <div>
      <ActivityActions
        availableActions={availableActions}
        activityId={practiceQuiz.id}
        activityName={practiceQuiz.name}
        activityType={practiceQuiz.type}
      />
      <div>
        {publishModal && (
          <PracticeQuizPublishingModal
            elementId={practiceQuiz.id}
            title={practiceQuiz.name}
            open={publishModal}
            setOpen={setPublishModal}
            courseId={practiceQuiz.courseId!}
            courseStartDate={practiceQuiz.courseStartDate}
          />
        )}
        {deletionModal && (
          <PracticeQuizDeletionModal
            open={deletionModal}
            setOpen={setDeletionModal}
            activityId={practiceQuiz.id}
            courseId={practiceQuiz.courseId!}
          />
        )}
        {sharingModal && practiceQuiz.isManager && (
          <ObjectSharingModalWrapper
            objectUuid={practiceQuiz.id}
            objectName={practiceQuiz.name}
            objectType={ObjectType.PracticeQuiz}
            isTemplate={isTemplate}
            isOwner={practiceQuiz.isOwner ?? false}
            open={sharingModal}
            onClose={() => setSharingModal(false)}
          />
        )}
        {removalModal && practiceQuiz.isRemovable && (
          <ActivityRemovalModal
            activityId={practiceQuiz.id}
            activityType={ActivityType.PracticeQuiz}
            title={practiceQuiz.name}
            isModalOpen={removalModal}
            setModalOpen={setRemovalModal}
          />
        )}
        <CopyConfirmationToast open={copyToast} setOpen={setCopyToast} />

        {practiceQuiz && (
          <ActivityLogDialog
            objectId={practiceQuiz.id}
            objectType={ObjectType.PracticeQuiz}
            open={activityLogOpen}
            onOpenChange={setActivityLogOpen}
          />
        )}
      </div>
    </div>
  )
}

export default PracticeQuizActions
