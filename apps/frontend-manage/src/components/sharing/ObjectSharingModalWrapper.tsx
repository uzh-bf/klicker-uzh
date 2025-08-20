import { ObjectType } from '@klicker-uzh/graphql/dist/ops'
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
  isOwner: boolean
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
  isOwner,
  onClose,
  refetchActivities,
  refetchElements,
}: ObjectSharingModalIdProps | ObjectSharingModalUuidProps) {
  const [transferModalOpen, setTransferModalOpen] = useState(false)

  if (typeof objectId === 'undefined' && typeof objectUuid === 'undefined') {
    return null
  }

  return (
    <>
      <ObjectSharingModal
        onClose={onClose}
        objectId={typeof objectId !== 'undefined' ? objectId : objectUuid!}
        objectType={objectType}
        objectName={objectName}
        isOwner={isOwner}
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
          refetchActivities={refetchActivities}
          refetchElements={refetchElements}
        />
      )}
    </>
  )
}

export default ObjectSharingModalWrapper
