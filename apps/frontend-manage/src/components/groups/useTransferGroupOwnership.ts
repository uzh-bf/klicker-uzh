import { useMutation } from '@apollo/client'
import {
  GetUserGroupsUserDocument,
  TransferGroupOwnershipDocument,
  UserGroup,
} from '@klicker-uzh/graphql/dist/ops'

function useTransferGroupOwnership() {
  const [transferGroupOwnership, { loading }] = useMutation(
    TransferGroupOwnershipDocument
  )

  const onOwnershipTransfer = async ({
    group,
    newOwnerId,
  }: {
    group: UserGroup
    newOwnerId: string
  }) => {
    try {
      await transferGroupOwnership({
        variables: {
          id: group.id,
          newOwnerId,
        },
        optimisticResponse: {
          transferGroupOwnership: true,
        },
        update: (cache, { data }) => {
          // check if request was successful
          if (!data?.transferGroupOwnership) return

          // update admins and owner of the group
          cache.updateQuery({ query: GetUserGroupsUserDocument }, (qData) => {
            if (!qData?.getUserGroupsUser) return qData

            return {
              getUserGroupsUser: qData.getUserGroupsUser.map(
                (existingGroup) => {
                  const newOwner = group.admins?.find(
                    (existingAdmin) => existingAdmin.id === newOwnerId
                  )
                  const newAdmin = group.owner

                  if (!newOwner || !newAdmin) return existingGroup
                  if (existingGroup.id === group.id) {
                    return {
                      ...existingGroup,
                      admins: existingGroup.admins
                        ?.filter((admin) => admin.id !== newOwnerId)
                        .concat(newAdmin),
                      owner: newOwner,
                      isOwner: false,
                      isAdmin: true,
                    }
                  }
                  return existingGroup
                }
              ),
            }
          })
        },
      })
    } catch (error) {
      console.error(error)
    }
  }

  return { onOwnershipTransfer, transferringOwnership: loading }
}

export default useTransferGroupOwnership
