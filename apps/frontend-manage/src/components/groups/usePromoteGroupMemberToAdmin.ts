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
    memberShortname,
    memberEmail,
  }: {
    groupId: number
    memberId: string
    memberShortname: string
    memberEmail: string
  }) => {
    try {
      await promoteGroupMemberToAdmin({
        variables: {
          groupId: groupId,
          memberId: memberId!,
        },
        optimisticResponse: {
          promoteGroupMemberToAdmin: true,
        },
        update: (cache, { data }) => {
          // check if request was successful
          const success = data?.promoteGroupMemberToAdmin
          if (!success) return

          // update members and admins of user group
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
                        admins: [
                          ...(existingGroup.admins ?? []),
                          {
                            id: memberId,
                            shortname: memberShortname,
                            email: memberEmail,
                          },
                        ],
                        members: existingGroup.members?.filter(
                          (m) => m.id !== memberId
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
    } catch (e) {
      console.error(e)
    }
  }

  return { onPromotion, promoting: loading }
}

export default usePromoteGroupMemberToAdmin
