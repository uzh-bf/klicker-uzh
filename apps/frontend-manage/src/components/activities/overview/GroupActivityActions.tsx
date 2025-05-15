import {
  ActivityInfo,
  ActivityType,
  ElementInstanceType,
  PublicationStatus,
  SharingObjectType,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useState } from 'react'
import ExtensionModal from '../../courses/modals/ExtensionModal'
import GroupActivityDeletionModal from '../../courses/modals/GroupActivityDeletionModal'
import GroupActivityEndingModal from '../../courses/modals/GroupActivityEndingModal'
import GroupActivityStartingModal from '../../courses/modals/GroupActivityStartingModal'
import PublishConfirmationModal from '../../courses/modals/PublishConfirmationModal'
import ObjectSharingModalWrapper from '../../sharing/ObjectSharingModalWrapper'
import useAvailableActions from '../actions/useAvailableActions'
import useGroupActivityActions from '../actions/useGroupActivityActions'
import ActivityActions from './ActivityActions'
import ActivityRemovalModal from './ActivityRemovalModal'

// create a map between the activity status and the available actions (in order)
const statusActionMap = {
  [PublicationStatus.Draft]: [
    'publishGroupActivity',
    'editGroupActivity',
    'shareGroupActivity',
    'removeGroupActivity',
    'deleteGroupActivity',
  ],
  [PublicationStatus.Scheduled]: [
    'startGroupActivityNow',
    'shareGroupActivity',
    'unpublishGroupActivity',
    'removeGroupActivity',
    'deleteGroupActivity',
  ],
  [PublicationStatus.Published]: [
    'extendGroupActivity',
    'endGroupActivity',
    'shareGroupActivity',
    'removeGroupActivity',
    'deleteGroupActivity',
  ],
  [PublicationStatus.Ended]: [
    'gradeGroupActivity',
    'shareGroupActivity',
    'removeGroupActivity',
    'deleteGroupActivity',
  ],
  [PublicationStatus.Graded]: [
    'gradeGroupActivity',
    'shareGroupActivity',
    'removeGroupActivity',
    'deleteGroupActivity',
  ],
  [PublicationStatus.Template]: [],
}

// limit the available actions based on the permission level (order irrelevant - lower levels automatically included)
const permissionActionMap = {
  isManager: ['shareGroupActivity', 'deleteGroupActivity'],
  isEditor: ['editGroupActivity'],
  isExecutor: [
    'publishGroupActivity',
    'unpublishGroupActivity',
    'startGroupActivityNow',
    'extendGroupActivity',
    'endGroupActivity',
    'gradeGroupActivity',
  ],
  isShared: [],
  isRemovable: ['removeGroupActivity'],
}

function GroupActivityActions({
  groupActivity,
  sharingModal,
  setSharingModal,
}: {
  groupActivity: ActivityInfo
  sharingModal: boolean
  setSharingModal: Dispatch<SetStateAction<boolean>>
}) {
  const t = useTranslations()
  const [deletionModal, setDeletionModal] = useState(false)
  const [endingModal, setEndingModal] = useState(false)
  const [startingModal, setStartingModal] = useState(false)
  const [publishingModal, setPublishingModal] = useState(false)
  const [extensionModal, setExtensionModal] = useState(false)
  const [removalModal, setRemovalModal] = useState(false)

  const actions = useGroupActivityActions({
    groupActivity,
    setRemovalModal,
    setDeletionModal,
    setEndingModal,
    setStartingModal,
    setPublishingModal,
    setExtensionModal,
    setSharingModal,
  })

  const availableActions = useAvailableActions({
    actions,
    statusActionMap,
    permissionActionMap,
    status: groupActivity.status,
    isEditor: groupActivity.isEditor,
    isExecutor: groupActivity.isExecutor,
    isManager: groupActivity.isManager,
    isOwner: groupActivity.isOwner,
    isRemovable: groupActivity.isRemovable,
    isShared: groupActivity.isShared,
  })

  return (
    <div>
      <ActivityActions
        availableActions={availableActions}
        activityId={groupActivity.id}
        activityName={groupActivity.name}
        activityType={groupActivity.type}
      />
      <div>
        {sharingModal && groupActivity.isManager && (
          <ObjectSharingModalWrapper
            objectUuid={groupActivity.id}
            objectName={groupActivity.name}
            objectType={SharingObjectType.GroupActivity}
            isOwner={groupActivity.isOwner ?? false}
            open={sharingModal}
            onClose={() => setSharingModal(false)}
          />
        )}
        {publishingModal && (
          <PublishConfirmationModal
            open={publishingModal}
            setOpen={setPublishingModal}
            elementType={ElementInstanceType.GroupActivity}
            elementId={groupActivity.id}
            title={groupActivity.name}
            courseId={groupActivity.courseId!}
            publicationHint={t('manage.course.groupActivityPublishingHint')}
          />
        )}
        <ExtensionModal
          open={extensionModal}
          setOpen={setExtensionModal}
          type="groupActivity"
          id={groupActivity.id}
          currentEndDate={groupActivity.scheduledEndAt}
          courseId={groupActivity.courseId!}
          title={t('manage.course.extendGroupActivity')}
          description={t('manage.course.extendGroupActivityDescription')}
        />

        {removalModal && groupActivity.isRemovable && (
          <ActivityRemovalModal
            activityId={groupActivity.id}
            activityType={ActivityType.GroupActivity}
            title={groupActivity.name}
            isModalOpen={removalModal}
            setModalOpen={setRemovalModal}
          />
        )}
        {deletionModal && (
          <GroupActivityDeletionModal
            open={deletionModal}
            setOpen={setDeletionModal}
            activityId={groupActivity.id}
            courseId={groupActivity.courseId!}
          />
        )}

        {endingModal && (
          <GroupActivityEndingModal
            open={endingModal}
            setOpen={setEndingModal}
            activityId={groupActivity.id}
            courseId={groupActivity.courseId!}
          />
        )}
        {startingModal && (
          <GroupActivityStartingModal
            open={startingModal}
            setOpen={setStartingModal}
            activityId={groupActivity.id}
            activityEndDate={groupActivity.scheduledEndAt}
            groupDeadlineDate={groupActivity.groupDeadlineDate}
            numOfParticipantGroups={groupActivity.numOfParticipantGroups ?? 0}
            courseId={groupActivity.courseId!}
          />
        )}
      </div>
    </div>
  )
}

export default GroupActivityActions
