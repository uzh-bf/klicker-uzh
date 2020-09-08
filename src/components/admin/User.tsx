import React, { useState } from 'react'
import { Icon, Button, Label, Confirm } from 'semantic-ui-react'
import { useMutation } from '@apollo/react-hooks'
import { useToasts } from 'react-toast-notifications'
import { FormattedMessage } from 'react-intl'
import getConfig from 'next/config'

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
  const { addToast } = useToasts()

  const { publicRuntimeConfig } = getConfig()
  


  const onUserModification = async (values, confirm) : Promise<any> => {
    if (!editConfirmation){
      setEditConfirmation(true)
        return
    }
    if (confirm){
      try{
       await modifyUser({
        variables: {id, email: values.email, shortname: values.shortname, institution: values.institution, role: values.role},
        })
        addToast(
          <FormattedMessage
            defaultMessage="User successfully modified."
            id="components.admin.user.edit.success"
          />,
          {
            appearance: 'success',
          }
        )
      }catch(error){
        addToast(
          <FormattedMessage
            defaultMessage="{errorMessage}"
            id="components.admin.user.edit.error"
            values={{ errorMessage: error.message }}
          />,
          {
            appearance: 'error',
          }
        ) 
      }
    }
    setEditConfirmation(false)
    setUserEditable(false)
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
              currentInstitution={institution}
              currentRole={role}
              currentShortname={shortname}
              editConfirmation={editConfirmation}
              handleModification={onUserModification}
              onDiscard={() : void => { setUserEditable(false) }}
            />
          )) || (
            <div className="content">
              <div className="information">
                <div className="informationTitle"><Icon circular inverted color="blue" name="user" /></div>
                <div className="informationContent">
                  <p><Icon name="mail" />Email: {email}</p>
                  <p><Icon name="hashtag" />Account ID / Join Link: {publicRuntimeConfig.baseUrl}/join/{shortname}</p>
                  <p><Icon name="university" />Institution: {institution}</p>
                  <p><Icon name="id badge" />Role: {role}</p>
                </div>
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
                  onClick={() : void =>{
                    setDeletionConfirmation(true)
                  }}
                >
                  <Icon name="trash" />
                  Delete User
                </Button>
                <Confirm 
                  cancelButton={'Go Back'}
                  confirmButton={'Delete User'}
                  content={`Are you sure that you want to delete the user ${id}?`}
                  open={deletionConfirmation}
                  onCancel={() : Promise<void> => handleUserDeletion(id, false)}
                  onConfirm={() : Promise<void>  => handleUserDeletion(id, true)}
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
                flex-direction: column;
                justify-content: space-between;
                p {
                  line-height: 100%;
                }

                .information {
                  display: flex;
                  width: 100%;
                  border: 1px solid rgb(124, 184, 228);
                  padding: 0.4rem;
                  margin-bottom: 0.2rem;
                  .informationTitle {
                    padding-left: 0.2rem;
                    background-color: rgb(124, 184, 228);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                  }
                  .informationContent {
                    padding: 0.4rem;
                  }
                }
                .buttonArea {
                  display: flex;
                  flex-direction: row;
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
