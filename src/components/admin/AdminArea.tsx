import React from 'react'
import { defineMessages, useIntl } from 'react-intl'
import { Tab } from 'semantic-ui-react'

import UserList from './UserList'

const messages = defineMessages({
  userManagement: {
    defaultMessage: 'User Management',
    id: 'admin.userManagement',
  },
})

function AdminArea(): React.ReactElement {
  const intl = useIntl()

  // Organized as array for the sake of extendability
  const panes = [
    {
      menuItem: intl.formatMessage(messages.userManagement),
      render: (): React.ReactElement => (
        <Tab.Pane>
          <UserList />
        </Tab.Pane>
      ),
    },
  ]

  return (
    <div className="adminArea">
      <Tab
        grid={{ paneWidth: 12, reversed: 'mobile', stackable: true, tabWidth: 4 }}
        menu={{ fluid: true, tabular: true, vertical: true }}
        menuPosition="right"
        panes={panes}
      />

      <style jsx>{`
        @import 'src/theme';

        .adminArea {
          padding: 1rem;

          @include desktop-only {
            margin: 0 20%;
            padding: 1rem 0;
          }
        }
      `}</style>
    </div>
  )
}

export default AdminArea
