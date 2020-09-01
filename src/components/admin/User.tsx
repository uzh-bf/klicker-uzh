import React from 'react'
import { Icon, Button } from 'semantic-ui-react'

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
  // id,
  email,
  shortname,
  institution,
  // isActive,
  isAAI,
}: // role,
Props): React.ReactElement {
  return (
    <div className="user">
      <div className="wrapper">
        <div className="header">
          <h2 className="email">
            {email} {isAAI ? ' (AAI)' : ''}
          </h2>
          <div className="userIcon">
            <Icon name="user outline" size="large" />
          </div>
        </div>
        <div className="body">
          <div className="userInformation">
            <p>Diesen Teil ersetzen mit Accountdataform?</p>
            <p>{institution}</p>
            <p>{shortname}</p>
          </div>
          <div className="edit">
            <div className="buttonContainer">
              <Button icon="edit" />
            </div>
            <div className="buttonContainer">
              <Button icon="trash" />
            </div>
          </div>
        </div>
      </div>

      <style jsx>
        {`
          @import 'src/theme';

          .user {
            display: flex;
            margin-bottom: 1rem;
            padding: 0.5rem;
            border: 1px solid gainsboro;
            background-color: #f9f9f9;
          }
          .wrapper {
            width: 100%;
            display: flex;
            flex-direction: column;

            .header {
              width: 100%;
              display: flex;
              justify-content: space-between;

              .email {
              }
              .userIcon {
                padding: 0.2rem;
              }
            }

            .body {
              width: 100%;
              display: flex;
              justify-content: space-between;
              border: 1px solid rgb(124, 184, 228);
              padding-left: 0.2rem;

              .edit {
                padding: 0.2rem;
                display: flex;
                flex-direction: column;
                justify-content: flex-end;
              }

              .buttonContainer + .buttonContainer {
                margin-top: 0.2rem;
              }
            }
          }
        `}
      </style>
    </div>
  )
}

export default User
