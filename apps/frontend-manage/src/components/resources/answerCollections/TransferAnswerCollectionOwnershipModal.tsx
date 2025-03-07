import { useMutation } from '@apollo/client'
import {
  GetAnswerCollectionPermissionsDocument,
  GetAnswerCollectionsInfoDocument,
  GetCatalogObjectsDocument,
  GetCatalogSharingRequestsDocument,
  TransferCollectionOwnershipDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import TransferOwnershipModal from '../../sharing/TransferOwnershipModal'

interface TransferAnswerCollectionOwnershipModalProps {
  open: boolean
  onClose: () => void
  collectionId: number
  collectionName: string
  catalogCollectionId?: string
}

function TransferAnswerCollectionOwnershipModal({
  open,
  onClose,
  collectionId,
  collectionName,
  catalogCollectionId,
}: TransferAnswerCollectionOwnershipModalProps) {
  const t = useTranslations()
  const [transferCollectionOwnership] = useMutation(
    TransferCollectionOwnershipDocument
  )

  return (
    <TransferOwnershipModal
      open={open}
      onClose={onClose}
      info={t.rich('manage.resources.transferOwnershipCollectionDescription', {
        collectionName,
        b: (chunks) => <strong>{chunks}</strong>,
      })}
      onTransferCallback={async (usernameOrEmail) => {
        const res = await transferCollectionOwnership({
          variables: {
            collectionId,
            usernameOrEmail,
          },
          refetchQueries: [
            GetAnswerCollectionsInfoDocument,
            GetCatalogSharingRequestsDocument,
            {
              // use refetch query instead of cache update, because new owner permissions might also
              // be removed in addition to the added new admin permission for the previous owner
              query: GetAnswerCollectionPermissionsDocument,
              variables: { collectionId },
            },
            {
              query: GetCatalogObjectsDocument,
              variables: { catalogCollectionId },
            },
          ],
        })

        if (res.data?.transferCollectionOwnership) {
          return true
        }

        return false
      }}
    />
  )
}

export default TransferAnswerCollectionOwnershipModal
