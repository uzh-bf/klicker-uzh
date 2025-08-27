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
                    numOfMembers: Math.max((group.numOfMembers ?? 1) - 1, 0),
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
      },
    })
  }

  return { onRemove, removing: loading }
}

export default useRemoveUserFromGroup
