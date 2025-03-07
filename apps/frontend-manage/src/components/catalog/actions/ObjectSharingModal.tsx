import { CatalogObjectType } from '@klicker-uzh/graphql/dist/ops'
import { useState } from 'react'
import AnswerCollectionSharingModal from '../../resources/answerCollections/AnswerCollectionSharingModal'
import TransferOwnershipModal from '../../sharing/TransferOwnershipModal'

function ObjectSharingModal({
  objectId,
  objectUuid,
  objectName,
  objectType,
  catalogCollectionId,
  isOwner,
  open,
  onClose,
}: {
  objectId?: number
  objectUuid?: string
  objectName: string
  objectType: CatalogObjectType
  catalogCollectionId?: string
  isOwner: boolean
  open: boolean
  onClose: () => void
}) {
  const [transferModalOpen, setTransferModalOpen] = useState(false)

  // TODO: once the sharing modal has been generalized as well, think about directly adding these two modals to the component above
  if (
    objectType === CatalogObjectType.AnswerCollection &&
    typeof objectId === 'number'
  ) {
    return (
      <>
        <AnswerCollectionSharingModal
          collectionId={objectId}
          collectionName={objectName}
          catalogCollectionId={catalogCollectionId}
          isOwner={isOwner}
          open={open}
          onClose={onClose}
          onOwnershipTransfer={() => setTransferModalOpen(true)}
        />
        <TransferOwnershipModal
          open={transferModalOpen}
          onClose={() => setTransferModalOpen(false)}
          objectId={objectId}
          objectType={CatalogObjectType.AnswerCollection}
          objectName={objectName}
          catalogCollectionId={catalogCollectionId}
        />
      </>
    )
  }

  // ... add more sharing modals for other objects here
}

export default ObjectSharingModal
