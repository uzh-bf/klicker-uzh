import { ObjectType } from '@lib/constants/sharingEnums'
import { useState } from 'react'
import ObjectSharingModal from './ObjectSharingModal'
import TransferOwnershipModal from './TransferOwnershipModal'

interface ObjectSharingModalBaseProps {
  objectId?: number
  objectUuid?: string
  objectName: string
  objectType: ObjectType
  isTemplate?: boolean
  courseId?: string
  catalogCollectionId?: string
  onClose: () => void
  refetchActivities?: () => Promise<void>
  refetchElements?: () => Promise<void>
}

interface ObjectSharingModalIdProps extends ObjectSharingModalBaseProps {
  objectId: number
  objectUuid?: never
}
interface ObjectSharingModalUuidProps extends ObjectSharingModalBaseProps {
  objectId?: never
  objectUuid: string
}

function ObjectSharingModalWrapper({
  objectId,
  objectUuid,
  objectName,
  objectType,
  isTemplate = false,
  catalogCollectionId,
  onClose,
  refetchActivities,
  refetchElements,
}: ObjectSharingModalIdProps | ObjectSharingModalUuidProps) {
  const [transferModalOpen, setTransferModalOpen] = useState(false)

  if (typeof objectId === 'undefined' && typeof objectUuid === 'undefined') {
    return null
  }

  const refreshActivitiesOnClose =
    objectType === ObjectType.LiveQuiz ||
    objectType === ObjectType.PracticeQuiz ||
    objectType === ObjectType.MicroLearning ||
    objectType === ObjectType.GroupActivity

  return (
    <>
      <ObjectSharingModal
        onClose={() => {
          onClose()

          const parentRefreshes = [
            objectType === ObjectType.Element ? refetchElements?.() : undefined,
            refreshActivitiesOnClose ? refetchActivities?.() : undefined,
          ].filter((refresh): refresh is Promise<void> => Boolean(refresh))

          if (parentRefreshes.length > 0) {
            void Promise.all(parentRefreshes).catch(console.error)
          }
        }}
        objectId={typeof objectId !== 'undefined' ? objectId : objectUuid!}
        objectType={objectType}
        objectName={objectName}
        onOwnershipTransfer={() => setTransferModalOpen(true)}
        derivedPermissionsAvailable={
          objectType !== ObjectType.CatalogCollection &&
          objectType !== ObjectType.Course
        }
        refetchElements={refetchElements}
        refetchActivities={refetchActivities}
      />
      {transferModalOpen && (
        <TransferOwnershipModal
          onClose={() => setTransferModalOpen(false)}
          objectId={typeof objectId !== 'undefined' ? objectId : objectUuid!}
          objectType={objectType}
          objectName={objectName}
          isTemplate={isTemplate}
          catalogCollectionId={catalogCollectionId}
        />
      )}
    </>
  )
}

export default ObjectSharingModalWrapper
