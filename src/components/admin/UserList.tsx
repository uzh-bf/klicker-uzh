import React from 'react'
import { useQuery } from '@apollo/react-hooks'
import { Loader, Message } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import UserListQuery from '../../graphql/queries/UserListQuery.graphql'
import User from './User'
import { buildIndex, filterByTitle } from '../../lib/utils/filters'

interface Props {
  filters: any
}

function UserList({ filters }: Props): React.ReactElement {
  const { data, loading, error } = useQuery(UserListQuery)

  if (loading) {
    return <Loader active />
  }
  if (error) {
    return <Message error>{error.message}</Message>
  }

  const { users } = data

  // create a user index TODO: define which attributes are desired searching
  const userIndex = buildIndex('users', users, ['email', 'shortname', 'institution'])

  // apply the filters
  const matchingUsers = filterByTitle(users, filters, userIndex)

  if (matchingUsers.length === 0) {
    return (
      <div className="userList">
        <h1>{filters.title}</h1>
        <FormattedMessage defaultMessage="No matching user was found." id="admin.AdminArea.UserManagement.noUsers" />
      </div>
    )
  }

  return (
    <div className="userList">
      {matchingUsers.map(({ id, email, shortname, institution, isActive, isAAI, role }) => {
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
