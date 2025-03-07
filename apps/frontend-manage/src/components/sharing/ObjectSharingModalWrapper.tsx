import { CatalogObjectType } from '@klicker-uzh/graphql/dist/ops'
import { useState } from 'react'
import ObjectSharingModal from './ObjectSharingModal'
import TransferOwnershipModal from './TransferOwnershipModal'

interface ObjectSharingModalBaseProps {
  objectId?: number
  objectUuid?: string
  objectName: string
  objectType: CatalogObjectType
  catalogCollectionId?: string
  isOwner: boolean
  open: boolean
  onClose: () => void
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
  catalogCollectionId,
  isOwner,
  open,
  onClose,
}: ObjectSharingModalIdProps | ObjectSharingModalUuidProps) {
  const [transferModalOpen, setTransferModalOpen] = useState(false)

  if (typeof objectId === 'undefined' && typeof objectUuid === 'undefined') {
    return null
  }

  return (
    <>
      <ObjectSharingModal
        open={open}
        onClose={onClose}
        objectId={typeof objectId !== 'undefined' ? objectId : objectUuid!}
        objectType={objectType}
        objectName={objectName}
        isOwner={isOwner}
        onOwnershipTransfer={() => setTransferModalOpen(true)}
      />
      <TransferOwnershipModal
        open={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        objectId={typeof objectId !== 'undefined' ? objectId : objectUuid!}
        objectType={objectType}
        objectName={objectName}
        catalogCollectionId={catalogCollectionId}
      />
    </>
  )
}

export default ObjectSharingModalWrapper
