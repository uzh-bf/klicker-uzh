import { useMutation } from '@apollo/client'
import {
  GetAnswerCollectionPermissionsDocument,
  GetAnswerCollectionsInfoDocument,
  GetCatalogSharingRequestsDocument,
  TransferCollectionOwnershipDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import TransferOwnershipModal from './TransferOwnershipModal'

interface TransferCollectionOwnershipModalProps {
  open: boolean
  onClose: () => void
  collectionId: number
  collectionName: string
}

function TransferCollectionOwnershipModal({
  open,
  onClose,
  collectionId,
  collectionName,
}: TransferCollectionOwnershipModalProps) {
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

export default TransferCollectionOwnershipModal
