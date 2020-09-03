import React, {useState} from 'react'
import { useQuery, useMutation } from '@apollo/react-hooks'
import { Loader, Message } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import { useToasts } from 'react-toast-notifications'
import DeleteUserMutation from '../../graphql/mutations/DeleteUserMutation.graphql'
import UserListQuery from '../../graphql/queries/UserListQuery.graphql'
import User from './User'
import { buildIndex, filterByTitle } from '../../lib/utils/filters'


interface Props {
  filters: any
}

function UserList({ filters }: Props): React.ReactElement {

  const { addToast } = useToasts()

  const { data, loading, error } = useQuery(UserListQuery)
  const [deleteUser] = useMutation(DeleteUserMutation)

  const [deletionConfirmation, setDeletionConfirmation] = useState(false)
  
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

  const onUserDeletion = async (userId : string, confirm : boolean) : Promise<void> => {
    if (!deletionConfirmation){
      setDeletionConfirmation(true)
      return
    }
    if (confirm){
      try {
        await deleteUser({
          refetchQueries: [{ query: UserListQuery }],
          variables: { id: userId },
        })
        addToast(
          'User Successfully deleted',
          {
            appearance: 'success',
          }
        )
      } catch({message}){
        addToast(
          'Unable to delete user: {erriormessage}',
          {
            appearance: 'success',
          }
        ) 
      }
  }
  setDeletionConfirmation(false)
    
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
          handleUserDeletion: onUserDeletion,
          deletionConfirmation,
          setDeletionConfirmation,
        }
        return <User {...userProps} />
      })}
    </div>
  )
}

export default UserList
