import { useMutation } from '@apollo/client'
import {
  ChangeUserGroupNameDocument,
  GetUserGroupsUserDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Dispatch, SetStateAction } from 'react'

function useChangeUserGroupName() {
  const [changeUserGroupName, { loading }] = useMutation(
    ChangeUserGroupNameDocument
  )

  const onNameChange = async ({
    groupId,
    newName,
    setTitleEditMode,
  }: {
    groupId: number
    newName: string
    setTitleEditMode: Dispatch<SetStateAction<boolean>>
  }) => {
    try {
      await changeUserGroupName({
        variables: {
          id: groupId,
          name: newName,
        },
        optimisticResponse: {
          changeUserGroupName: true,
        },
        update: (cache, { data }) => {
          // check if request was successful
          const success = data?.changeUserGroupName
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
                        name: newName,
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
      setTitleEditMode(false)
    } catch (error) {
      console.error(error)
    }
  }

  return { onNameChange, nameChanging: loading }
}

export default useChangeUserGroupName
