import { useMutation } from '@apollo/client'
import {
  GetCatalogCollectionPermissionsDocument,
  GetCatalogCollectionsListDocument,
  TransferCatalogCollectionOwnershipDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import TransferOwnershipModal from '../../sharing/TransferOwnershipModal'

interface TransferCatalogCollectionOwnershipModalProps {
  open: boolean
  onClose: () => void
  catalogCollectionId: string
  catalogCollectionName: string
}

function TransferCatalogCollectionOwnershipModal({
  open,
  onClose,
  catalogCollectionId,
  catalogCollectionName,
}: TransferCatalogCollectionOwnershipModalProps) {
  const t = useTranslations()
  const [transferCatalogCollectionOwnership] = useMutation(
    TransferCatalogCollectionOwnershipDocument
  )

  return (
    <TransferOwnershipModal
      open={open}
      onClose={onClose}
      info={t.rich('manage.catalog.transferOwnershipCollectionDescription', {
        catalogCollectionName,
        b: (chunks) => <strong>{chunks}</strong>,
      })}
      onTransferCallback={async (usernameOrEmail) => {
        const res = await transferCatalogCollectionOwnership({
          variables: {
            catalogCollectionId,
            usernameOrEmail,
          },
          refetchQueries: [
            // use refetch query instead of cache update, because new owner permissions might also
            // be removed in addition to the added new admin permission for the previous owner
            {
              query: GetCatalogCollectionPermissionsDocument,
              variables: { catalogCollectionId },
            },
            GetCatalogCollectionsListDocument,
          ],
        })

        if (res.data?.transferCatalogCollectionOwnership) {
          return true
        }

        return false
      }}
    />
  )
}

export default TransferCatalogCollectionOwnershipModal
