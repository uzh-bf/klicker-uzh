import {
  ActivityInfo,
  ElementInstanceType,
  PublicationStatus,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import ExtensionModal from '~/components/courses/modals/ExtensionModal'
import GroupActivityDeletionModal from '../../courses/modals/GroupActivityDeletionModal'
import GroupActivityEndingModal from '../../courses/modals/GroupActivityEndingModal'
import GroupActivityStartingModal from '../../courses/modals/GroupActivityStartingModal'
import PublishConfirmationModal from '../../courses/modals/PublishConfirmationModal'
import useAvailableActions from '../actions/useAvailableActions'
import useGroupActivityActions from '../actions/useGroupActivityActions'
import ActivityActions from './ActivityActions'

// create a map between the activity status and the available actions (in order)
const statusActionMap = {
  [PublicationStatus.Draft]: [
    'publishGroupActivity',
    'editGroupActivity',
    'deleteGroupActivity',
  ],
  [PublicationStatus.Scheduled]: [
    'startGroupActivityNow',
    'unpublishGroupActivity',
    'deleteGroupActivity',
  ],
  [PublicationStatus.Published]: [
    'extendGroupActivity',
    'endGroupActivity',
    'deleteGroupActivity',
  ],
  [PublicationStatus.Ended]: ['gradeGroupActivity', 'deleteGroupActivity'],
  [PublicationStatus.Graded]: ['gradeGroupActivity', 'deleteGroupActivity'],
  [PublicationStatus.Template]: [],
}

// limit the available actions based on the permission level (order irrelevant - lower levels automatically included)
const permissionActionMap = {
  isManager: ['deleteGroupActivity'],
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
  isRemovable: [],
}

function GroupActivityActions({
  groupActivity,
}: {
  groupActivity: ActivityInfo
}) {
  const t = useTranslations()
  const [deletionModal, setDeletionModal] = useState(false)
  const [endingModal, setEndingModal] = useState(false)
  const [startingModal, setStartingModal] = useState(false)
  const [publishingModal, setPublishingModal] = useState(false)
  const [extensionModal, setExtensionModal] = useState(false)

  const actions = useGroupActivityActions({
    groupActivity,
    setDeletionModal,
    setEndingModal,
    setStartingModal,
    setPublishingModal,
    setExtensionModal,
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
