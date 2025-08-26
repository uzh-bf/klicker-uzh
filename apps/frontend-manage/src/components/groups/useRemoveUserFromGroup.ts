import { useMutation } from '@apollo/client'
import {
  GetUserGroupsUserDocument,
  RemoveUserFromGroupDocument,
} from '@klicker-uzh/graphql/dist/ops'

function useRemoveUserFromGroup() {
  const [removeUserFromGroup, { loading }] = useMutation(
    RemoveUserFromGroupDocument
  )

  const onRemove = async ({
    groupId,
    userId,
  }: {
    groupId: number
    userId: string
  }) => {
    await removeUserFromGroup({
      variables: {
        groupId: groupId,
        userId: userId!,
      },
      optimisticResponse: {
        removeUserFromGroup: true,
      },
      update: (cache, { data }) => {
        // check if request was successful
        if (!data?.removeUserFromGroup) return

        // update members and admins of user group
        cache.updateQuery({ query: GetUserGroupsUserDocument }, (qData) => {
          if (!qData?.getUserGroupsUser) return qData
          return {
            getUserGroupsUser: qData.getUserGroupsUser.map((group) =>
              group.id === groupId
                ? {
                    ...group,
                    members: group.members?.filter(
                      (member) => member.id !== userId
                    ),
                    admins: group.admins?.filter(
                      (admin) => admin.id !== userId
                    ),
                  }
                : group
            ),
          }
        })

        const userGroups = cache.readQuery({
          query: GetUserGroupsUserDocument,
        })

        if (userGroups?.getUserGroupsUser) {
          cache.writeQuery({
            query: GetUserGroupsUserDocument,
            data: {
              getUserGroupsUser: userGroups?.getUserGroupsUser.map(
                (existingGroup) => {
                  if (groupId === existingGroup.id) {
                    return {
                      ...existingGroup,
                      numOfMembers: Math.max(
                        (existingGroup.numOfMembers ?? 1) - 1,
                        0
                      ),
                      admins: existingGroup.admins?.filter(
                        (admin) => admin.id !== userId
                      ),
                      members: existingGroup.members?.filter(
                        (member) => member.id !== userId
                      ),
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
  }

  return { onRemove, removing: loading }
}

export default useRemoveUserFromGroup
