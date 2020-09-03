import React, { useState } from 'react'
import { Icon, Button, Label, Confirm } from 'semantic-ui-react'
import { useMutation } from '@apollo/react-hooks'

import ModifyUserForm from '../forms/userManagement/ModifyUserForm'
import ModifyUserAsAdminMutation from '../../graphql/mutations/ModifyUserAsAdminMutation.graphql'

interface Props {
  id: string
  email: string
  shortname: string
  institution: string
  isActive: boolean
  isAAI: boolean
  role: string
  handleUserDeletion: (userId, confirm) => Promise<void>
  deletionConfirmation: boolean,
  setDeletionConfirmation: any,
}

function User({
  id,
  email,
  shortname,
  institution,
  isAAI,
  role,
  handleUserDeletion,
  deletionConfirmation,
  setDeletionConfirmation,
}: 
Props): React.ReactElement {

  const [userEditable, setUserEditable] = useState(false)
  const [editConfirmation, setEditConfirmation] = useState(false)
  const [modifyUser] = useMutation(ModifyUserAsAdminMutation)

  const onUserModification = async (values, confirm) : Promise<any> => {
    if (!editConfirmation){
      setEditConfirmation(true)
      return
    }
    if (confirm){
       await modifyUser({
        variables: {id, user: {email, shortname, institution, role}},
        })
    }
    setEditConfirmation(false)
  } 
    


  return (
    <div className="user">
      <div className="wrapper">
        <div className="header">
          {isAAI && <Label className="AAILabel" content={'AAI'} />}
          <Label className="emailLabel" content={email} icon="user outline" />
        </div>
        <div className="body">
          {(userEditable && (
            <ModifyUserForm
              currentEmail={email}
              currentInsitution={institution}
              currentRole={role}
              currentShortname={shortname}
              editConfirmation={editConfirmation}
              handleModification={onUserModification}
              id={id}
              onDiscard={() => { setUserEditable(false) }}
            />
          )) || (
            <div className="content">
              <div className="information">
                <div className="informationTitle">User-Information</div>
                <p>Email: {email}</p>
                <p>Shortname: {shortname}</p>
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
                <Button 
                  icon 
                  disabled={role === 'ADMIN'} 
                  labelPosition="left"
                  onClick={()=>{
                    setDeletionConfirmation(true)
                  }}
                >
                  <Icon name="trash" />
                  Delete User
                </Button>
                <h1>{id}</h1>
                <Confirm 
                  cancelButton={'Go Back'}
                  confirmButton={'Delete User'}
                  content={`Are you sure that you want to delete the user ${id}?`}
                  open={deletionConfirmation}
                  onCancel={() => handleUserDeletion(id, false)}
                  onConfirm={() => handleUserDeletion(id, true)}
                />         
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
