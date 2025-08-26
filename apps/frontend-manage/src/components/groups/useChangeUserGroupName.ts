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
          if (!data?.changeUserGroupName) return

          // update members and admins of user group
          cache.updateQuery({ query: GetUserGroupsUserDocument }, (qData) => {
            if (!qData?.getUserGroupsUser) return

            return {
              getUserGroupsUser: qData.getUserGroupsUser.map((group) =>
                group.id === groupId ? { ...group, name: newName } : group
              ),
            }
          })
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
