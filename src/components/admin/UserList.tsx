import React, { useState } from 'react'
import dayjs from 'dayjs'
import { useQuery, useMutation } from '@apollo/react-hooks'
import { Loader, Message } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import { useToasts } from 'react-toast-notifications'
import DeleteUserMutation from '../../graphql/mutations/DeleteUserMutation.graphql'
import ModifyUserAsAdminMutation from '../../graphql/mutations/ModifyUserAsAdminMutation.graphql'
import UserListQuery from '../../graphql/queries/UserListQuery.graphql'
import CustomizableTable from '../common/CustomizableTable'
import { buildIndex, filterByTitle } from '../../lib/utils/filters'
import { ROLES } from '../../constants'

interface Props {
  filters: any
}

function UserList({ filters }: Props): React.ReactElement {
  const { addToast } = useToasts()

  const { data, loading, error } = useQuery(UserListQuery)
  const [deleteUser] = useMutation(DeleteUserMutation)
  const [modifyUser] = useMutation(ModifyUserAsAdminMutation)

  const [deletionConfirmation, setDeletionConfirmation] = useState(false)
  const [editConfirmation, setEditConfirmation] = useState(false)

  const onUserDeletion = async (userId: string, confirm: boolean): Promise<void> => {
    if (!deletionConfirmation) {
      setDeletionConfirmation(true)
      return
    }
    if (confirm) {
      try {
        await deleteUser({
          refetchQueries: [{ query: UserListQuery }],
          variables: { id: userId },
        })
        addToast(
          <FormattedMessage
            defaultMessage="User successfully deleted."
            id="components.admin.userlist.delete.success"
          />,
          {
            appearance: 'success',
          }
        )
      } catch ({ message }) {
        addToast(
          <FormattedMessage
            defaultMessage="{errorMessage}"
            id="components.admin.userList.delete.error"
            values={{ errorMessage: message }}
          />,
          {
            appearance: 'error',
          }
        )
      }
    }
    setDeletionConfirmation(false)

    console.log(`Deleted ${userId}`)
  }

  const onUserModification = async (userId: string, values: any, confirm: boolean): Promise<any> => {
    if (!editConfirmation) {
      setEditConfirmation(true)
      return
    }
    if (confirm) {
      try {
        await modifyUser({
          variables: {
            id: userId,
            email: values.email,
            shortname: values.shortname,
            institution: values.institution,
            role: values.role,
          },
        })
        addToast(
          <FormattedMessage defaultMessage="User successfully modified." id="components.admin.user.edit.success" />,
          {
            appearance: 'success',
          }
        )
      } catch ({ message }) {
        addToast(
          <FormattedMessage
            defaultMessage="{errorMessage}"
            id="components.admin.user.edit.error"
            values={{ errorMessage: message }}
          />,
          {
            appearance: 'error',
          }
        )
      }
    }
    setEditConfirmation(false)
  }

  // converts the data of the user such that it can be displayed in the table
  const convertAttributeValues = (users: any[]): any => {
    const convertedUserList = []
    users.forEach((user) => {
      const convertedUser = { ...user }
      convertedUser.createdAt = dayjs(user.createdAt).format('YYYY-MM-DD')
      convertedUser.updatedAt = dayjs(user.updatedAt).format('YYYY-MM-DD')
      convertedUser.isAAI = user.isAAI ? 'Yes' : 'No'
      convertedUserList.push(convertedUser)
    })
    return convertedUserList
  }

  if (loading) {
    return <Loader active />
  }
  if (error) {
    return <Message error>{error.message}</Message>
  }

  const { users } = data

  // create a user index TODO: define which attributes are desired searching
  const userIndex = buildIndex('users', users, ['email', 'shortname', 'institution', 'role'])

  // apply the filters
  const filteredUsers = filterByTitle(users, filters, userIndex)

  const matchingUsers = convertAttributeValues(filteredUsers)

  if (matchingUsers.length === 0) {
    return (
      <div className="userList">
        <h1>{filters.title}</h1>
        <FormattedMessage defaultMessage="No matching user was found." id="admin.AdminArea.UserManagement.noUsers" />
      </div>
    )
  }


  const tableColumns = [
    {
      title: 'Email',
      attributeName: 'email',
      width: 4,
      isEditable: true,
    },
    {
      title: 'Shortname',
      attributeName: 'shortname',
      width: 2,
      isEditable: true,
    },
    {
      title: 'Institution',
      attributeName: 'institution',
      width: 2,
      isEditable: true,
    },
    {
      title: 'Role',
      attributeName: 'role',
      width: 2,
      isEditable: true,
      isDropdown: true,
      dropdownOptions: [
        {
          text: 'User',
          value: ROLES.USER,
        },
        {
          text: 'Admin',
          value: ROLES.ADMIN,
        },
      ],
    },
    {
      title: 'Last Login',
      attributeName: 'updatedAt',
      width: 2,
      isEditable: false,
    },
    {
      title: 'Created at',
      attributeName: 'createdAt',
      width: 2,
      isEditable: false,
    },
    {
      title: 'AAI',
      attributeName: 'isAAI',
      width: 1,
      isEditable: false,
    },
  ]

  return (
    <div className="userList">
      <CustomizableTable
        hasDeletion
        hasModification
        columns={tableColumns}
        data={matchingUsers}
        deletionConfirmation={deletionConfirmation}
        editConfirmation={editConfirmation}
        handleDeletion={onUserDeletion}
        handleModification={onUserModification}
      />
    </div>
  )
}

export default UserList
