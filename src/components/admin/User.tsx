import React, { useState } from 'react'
import { Icon, Button, Label } from 'semantic-ui-react'
// import { useMutation } from '@apollo/react-hooks'

// import DeleteUserMutation from '../../graphql/mutations/DeleteUserMutation.graphql'
import ModifyUserForm from '../forms/userManagement/ModifyUserForm'

interface Props {
  id: string
  email: string
  shortname: string
  institution: string
  isActive: boolean
  isAAI: boolean
  role: string
}

function User({
  id,
  email,
  shortname,
  institution,
  role,
}: // isAAI,
Props): React.ReactElement {
  // const [deleteUser] = useMutation(DeleteUserMutation)

  const [userEditable, setUserEditable] = useState(false)

  /*
  const handleUserDeletion = async (userId : string) : Promise<void> => {
    // TODO open some popup and confirm that you want to delete the user
    deleteUser({variables: { id: userId }})
  }
  */

  return (
    <div className="user">
      <div className="wrapper">
        <div className="header">
          {true && <Label className="AAILabel" content={'AAI'} />}
          <Label className="emailLabel" content={email} icon="user outline" />
        </div>
        <div className="body">
          {(userEditable && (
            <ModifyUserForm
              currentEmail={email}
              currentInsitution={institution}
              currentRole={role}
              currentShortname={shortname}
              id={id}
            />
          )) || (
            <div className="content">
              <div className="information">
                <div className="informationTitle">User-Information</div>
                <p>Email: {email}</p>
                <p>Shortname: {email}</p>
                <p>Institution: {institution}</p>
                <p>Role: {role}</p>
              </div>
              <div className="buttonArea">
                <Button
                  icon
                  labelPosition="left"
                  onClick={(): void => {
                    setUserEditable(true)
                  }}
                >
                  <Icon name="edit" />
                  Edit User
                </Button>
                <Button icon disabled={role === 'ADMIN'} labelPosition="left">
                  <Icon name="trash" />
                  Delete User
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>
        {`
          @import 'src/theme';

          .user {
            margin-bottom: 1rem;
            padding: 0.5rem;
            border: 1px solid gainsboro;
            background-color: #f9f9f9;
          }

          :global(.label.emailLabel) {
            order: 2;
            min-width: 15rem;
            border-right: 1px solid rgb(124, 184, 228);
            border-top: 1px solid rgb(124, 184, 228);
          }

          :global(.label.AAILabel) {
            order: 1;
            width: 3rem;
            border-right: 1px solid rgb(124, 184, 228);
            border-top: 1px solid rgb(124, 184, 228);
          }

          :global(.ui.labeled.icon.button) {
            margin-top: 0.2rem;
          }

          .wrapper {
            width: 100%;

            .header {
              width: 100%;
              display: flex;
              justify-content: flex-end;

              .email {
              }
              .userIcon {
                padding: 0.2rem;
              }
            }

            .body {
              width: 100%;
              border: 1px solid rgb(124, 184, 228);
              padding: 0.5rem;
              overflow-y: auto;

              .content {
                font-size: 14px;
                display: flex;
                flex-direction: row;
                justify-content: space-between;
                p {
                  line-height: 100%;
                }

                .information {
                  width: 75%;
                  .informationTitle {
                    font-weight: bold;
                    margin-bottom: 0.5rem;
                    padding-left: 0.2rem;
                    background-color: rgb(124, 184, 228);
                  }
                }
                .buttonArea {
                  display: flex;
                  flex-direction: column;
                  align-self: flex-end;
                }
              }
            }
          }
        `}
      </style>
    </div>
  )
}

export default User
