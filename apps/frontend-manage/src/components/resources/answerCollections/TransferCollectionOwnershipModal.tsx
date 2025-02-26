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
          update: (cache, { data }) => {
            if (!data?.transferCollectionOwnership) return

            const cacheRes = cache.readQuery({
              query: GetAnswerCollectionPermissionsDocument,
              variables: {
                collectionId,
              },
            })

            const prevPermissions = cacheRes?.getAnswerCollectionPermissions
            if (
              prevPermissions === null ||
              typeof prevPermissions === 'undefined'
            ) {
              return
            }

            // update the permissions list with the current owner as an admin user
            const newPermissions = prevPermissions.filter(
              (permission) =>
                permission.permissionId !==
                data.transferCollectionOwnership!.permissionId
            )
            newPermissions.push(data.transferCollectionOwnership)
            cache.writeQuery({
              query: GetAnswerCollectionPermissionsDocument,
              variables: {
                collectionId,
              },
              data: {
                getAnswerCollectionPermissions: newPermissions,
              },
            })
          },
          refetchQueries: [
            GetAnswerCollectionsInfoDocument,
            GetCatalogSharingRequestsDocument,
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
