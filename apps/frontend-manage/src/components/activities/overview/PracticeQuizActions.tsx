import {
  ActivityInfo,
  PublicationStatus,
  SharingObjectType,
} from '@klicker-uzh/graphql/dist/ops'
import { useState } from 'react'
import ObjectSharingModalWrapper from '~/components/sharing/ObjectSharingModalWrapper'
import PracticeQuizDeletionModal from '../../courses/modals/PracticeQuizDeletionModal'
import PracticeQuizPublishingModal from '../../courses/modals/PracticeQuizPublishingModal'
import CopyConfirmationToast from '../../toasts/CopyConfirmationToast'
import useAvailableActions from '../actions/useAvailableActions'
import usePracticeQuizActions from '../actions/usePracticeQuizActions'
import ActivityActions from './ActivityActions'

// create a map between the activity status and the available actions (in order)
const statusActionMap = {
  [PublicationStatus.Draft]: [
    'publishPracticeQuiz',
    'editPracticeQuiz',
    'openPreview',
    'copyAccessLink',
    'copyLTIAccessLink',
    'duplicatePracticeQuiz',
    'sharePracticeQuiz',
    'deletePracticeQuiz',
  ],
  [PublicationStatus.Scheduled]: [
    'copyAccessLink',
    'openPreview',
    'copyLTIAccessLink',
    'duplicatePracticeQuiz',
    'sharePracticeQuiz',
    'unpublishPracticeQuiz',
    'deletePracticeQuiz',
  ],
  [PublicationStatus.Published]: [
    'openEvaluation',
    'copyAccessLink',
    'openPreview',
    'copyLTIAccessLink',
    'duplicatePracticeQuiz',
    'analyticsPracticeQuiz',
    'sharePracticeQuiz',
    'deletePracticeQuiz',
  ],
  [PublicationStatus.Ended]: [],
  [PublicationStatus.Template]: [],
  [PublicationStatus.Graded]: [],
}

// limit the available actions based on the permission level (order irrelevant - lower levels automatically included)
const permissionActionMap = {
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
    'analyticsPracticeQuiz',
  ],
  isRemovable: [],
}

function PracticeQuizActions({ practiceQuiz }: { practiceQuiz: ActivityInfo }) {
  const [publishModal, setPublishModal] = useState(false)
  const [deletionModal, setDeletionModal] = useState(false)
  const [sharingModal, setSharingModal] = useState(false)
  const [copyToast, setCopyToast] = useState(false)

  const actions = usePracticeQuizActions({
    practiceQuiz,
    setPublishModal,
    setDeletionModal,
    setSharingModal,
    setCopyToast,
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
            objectType={SharingObjectType.PracticeQuiz}
            isOwner={practiceQuiz.isOwner ?? false}
            open={sharingModal}
            onClose={() => setSharingModal(false)}
          />
        )}
        <CopyConfirmationToast open={copyToast} setOpen={setCopyToast} />
      </div>
    </div>
  )
}

export default PracticeQuizActions
