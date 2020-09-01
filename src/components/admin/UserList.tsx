import React from 'react'
import { useQuery } from '@apollo/react-hooks'
import { Loader, Message } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import UserListQuery from '../../graphql/queries/UserListQuery.graphql'
import User from './User'

function UserList(): React.ReactElement {
  const { data, loading, error } = useQuery(UserListQuery)

  if (loading) {
    return <Loader active />
  }
  if (error) {
    return <Message error>{error.message}</Message>
  }

  const { users } = data

  if (users.length === 0) {
    return (
      <div className="user">
        <FormattedMessage defaultMessage="No user was found." id="admin.AdminArea.UserManagement.noUsers" />
      </div>
    )
  }

  return (
    <div className="userList">
      {users.map(({ id, email, shortname, institution, isActive, isAAI, role }) => {
        const userProps = {
          id,
          email,
          shortname,
          institution,
          isActive,
          isAAI,
          role,
        }
        return <User {...userProps} />
      })}
    </div>
  )
}

export default UserList
