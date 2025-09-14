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
  }: {
    groupId: number
    adminId: string
  }) => {
    try {
      await demoteGroupAdminToMember({
        variables: { groupId, adminId },
        optimisticResponse: { demoteGroupAdminToMember: true },
        update: (cache, { data }) => {
          // verify that the demotion was successful
          if (!data?.demoteGroupAdminToMember) return

          cache.updateQuery({ query: GetUserGroupsUserDocument }, (qData) => {
            if (!qData?.getUserGroupsUser) return qData

            return {
              getUserGroupsUser: qData.getUserGroupsUser.map(
                (existingGroup) => {
                  if (groupId === existingGroup.id) {
                    const removedAdmin = existingGroup.admins?.find(
                      (a) => a.id === adminId
                    )
                    if (!removedAdmin) return existingGroup

                    return {
                      ...existingGroup,
                      admins: existingGroup.admins?.filter(
                        (a) => a.id !== adminId
                      ),
                      members: [...(existingGroup.members ?? []), removedAdmin],
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

  return { onDemotion, demoting: loading }
}

export default useDemoteGroupAdminToMember
