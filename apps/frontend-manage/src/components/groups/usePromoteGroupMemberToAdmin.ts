import { useMutation } from '@apollo/client'
import {
  GetUserGroupsUserDocument,
  PromoteGroupMemberToAdminDocument,
} from '@klicker-uzh/graphql/dist/ops'

function usePromoteGroupMemberToAdmin() {
  const [promoteGroupMemberToAdmin, { loading }] = useMutation(
    PromoteGroupMemberToAdminDocument
  )

  const onPromotion = async ({
    groupId,
    memberId,
  }: {
    groupId: number
    memberId: string
  }) => {
    try {
      await promoteGroupMemberToAdmin({
        variables: { groupId, memberId },
        optimisticResponse: { promoteGroupMemberToAdmin: true },
        update: (cache, { data }) => {
          // verify that the promotion was successful
          if (!data?.promoteGroupMemberToAdmin) return

          cache.updateQuery({ query: GetUserGroupsUserDocument }, (qData) => {
            if (!qData?.getUserGroupsUser) return qData

            return {
              getUserGroupsUser: qData.getUserGroupsUser.map(
                (existingGroup) => {
                  if (groupId === existingGroup.id) {
                    const promotedMember = existingGroup.members?.find(
                      (m) => m.id === memberId
                    )
                    if (!promotedMember) return existingGroup

                    return {
                      ...existingGroup,
                      admins: [...(existingGroup.admins ?? []), promotedMember],
                      members: existingGroup.members?.filter(
                        (m) => m.id !== memberId
                      ),
                    }
                  }

                  return existingGroup
                }
              ),
            }
          })
        },
      })
    } catch (e) {
      console.error(e)
    }
  }

  return { onPromotion, promoting: loading }
}

export default usePromoteGroupMemberToAdmin
