import React from 'react'
import { Icon } from 'semantic-ui-react'

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
}: // shortname,
// institution,
// isActive,
// isAAI,
// role,

Props): React.ReactElement {
  return (
    <div className="user">
      <div className="wrapper">
        <h2 className="email">{email}</h2>
        <div className="userIcon">
          <Icon name="user" />
        </div>
        <div className="userDetails">
          <p>Hello world</p>
        </div>
      </div>

      <style jsx>
        {`
          @import 'src/theme';
          .user {
            display: flex;
            flex-flow: column nowrap;
            margin-bottom: 1rem;
            padding: 0.5rem;
            border: 1px solid gainsboro;
            background-color: #f9f9f9;
          }
          .wrapper {
            display: flex;
          }

          .email {
            flex: 1;
          }

          .userIcon {
          }
        `}
      </style>
    </div>
  )
}

export default User
