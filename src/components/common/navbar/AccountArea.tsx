/* eslint-disable react/prop-types */

import * as React from 'react'
import Link from 'next/link'
import { Icon, Dropdown } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

interface Props {
  accountShort?: string
  onLogout: any
}

const defaultProps = {
  accountShort: '-',
}

const AccountArea: React.FunctionComponent<Props> = ({ accountShort, onLogout }): React.ReactElement<any> => (
  <Dropdown item simple icon="user" text={`${accountShort} `}>
    <Dropdown.Menu>
      <Link href="/user/settings">
        <Dropdown.Item>
          <Icon name="settings" />
          <FormattedMessage defaultMessage="Settings" id="common.string.settings" />
        </Dropdown.Item>
      </Link>
      <Dropdown.Item onClick={onLogout}>
        <Icon name="log out" />
        <FormattedMessage defaultMessage="Logout" id="common.string.logout" />
      </Dropdown.Item>
    </Dropdown.Menu>
  </Dropdown>
)

AccountArea.defaultProps = defaultProps

export default AccountArea
