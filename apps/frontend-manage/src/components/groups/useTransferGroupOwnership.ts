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
          const success = data?.transferGroupOwnership
          if (!success) return

          // update admins and owner of the group
          const userGroups = cache.readQuery({
            query: GetUserGroupsUserDocument,
          })
          const newOwner = group.admins?.find(
            (existingAdmin) => existingAdmin.id === newOwnerId
          )
          const newAdmin = group.owner

          if (userGroups?.getUserGroupsUser && newOwner && newAdmin) {
            cache.writeQuery({
              query: GetUserGroupsUserDocument,
              data: {
                getUserGroupsUser: userGroups?.getUserGroupsUser.map(
                  (existingGroup) => {
                    if (group.id === existingGroup.id) {
                      return {
                        ...existingGroup,
                        // replace previous admin user through previous owner
                        admins: existingGroup.admins?.map((existingAdmin) => {
                          if (existingAdmin.id === newOwner?.id) {
                            return newAdmin
                          }
                          return existingAdmin
                        }),
                        // replace owner with new owner
                        owner: newOwner,
                        isAdmin: true,
                        isOwner: false,
                      }
                    }
                    return existingGroup
                  }
                ),
              },
            })
          }
        },
      })
    } catch (error) {
      console.error(error)
    }
  }

  return { onOwnershipTransfer, transferringOwnership: loading }
}

export default useTransferGroupOwnership
