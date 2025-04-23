import { useMutation } from '@apollo/client'
import {
  DemoteGroupAdminToMemberDocument,
  GetUserGroupsUserDocument,
} from '@klicker-uzh/graphql/dist/ops'

function useDemoteGroupAdminToMember() {
  const [demoteGroupAdminToMember, { loading }] = useMutation(
    DemoteGroupAdminToMemberDocument
  )

  const onDemotion = async ({
    groupId,
    adminId,
    adminShortname,
    adminEmail,
  }: {
    groupId: number
    adminId: string
    adminShortname: string
    adminEmail: string
  }) => {
    try {
      await demoteGroupAdminToMember({
        variables: {
          groupId: groupId,
          adminId: adminId!,
        },
        optimisticResponse: {
          demoteGroupAdminToMember: true,
        },
        update: (cache, { data }) => {
          // check if request was successful
          const success = data?.demoteGroupAdminToMember
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
                        admins: existingGroup.admins?.filter(
                          (a) => a.id !== adminId
                        ),
                        members: [
                          ...(existingGroup.members ?? []),
                          {
                            id: adminId,
                            shortname: adminShortname,
                            email: adminEmail,
                          },
                        ],
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

  return { onDemotion, demoting: loading }
}

export default useDemoteGroupAdminToMember
