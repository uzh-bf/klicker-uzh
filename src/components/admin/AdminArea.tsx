import React from 'react'
import { defineMessages, useIntl } from 'react-intl'
import { Tab } from 'semantic-ui-react'

import UserList from './UserList'
import RunningSessionList from './RunningSessionList'

const messages = defineMessages({
  userManagement: {
    defaultMessage: 'User Management',
    id: 'admin.userManagement',
  },
  runningSessions: {
    defaultMessage: 'Running Sessions',
    id: 'admin.runningSessions',
  },
})

interface Props {
  filters: any
}

function AdminArea({ filters }: Props): React.ReactElement {
  const intl = useIntl()

  const panes = [
    {
      menuItem: intl.formatMessage(messages.userManagement),
      render: (): React.ReactElement => (
        <Tab.Pane>
          <UserList filters={filters} />
        </Tab.Pane>
      ),
    },
    {
      menuItem: intl.formatMessage(messages.runningSessions),
      render: (): React.ReactElement => (
        <Tab.Pane>
          <RunningSessionList filters={filters} />
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
            margin: 0 5%;
            padding: 1rem 0;
          }
        }
      `}</style>
    </div>
  )
}

export default AdminArea
