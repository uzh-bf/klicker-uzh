// @flow

import React from 'react'
import { Dropdown } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

type Props = {
  accountShort: string,
}

const AccountArea = ({ accountShort }: Props) => (
  <Dropdown item simple text={accountShort}>
    <Dropdown.Menu>
      <Dropdown.Item>
        <FormattedMessage id="common.string.settings" defaultMessage="Settings" />
      </Dropdown.Item>
      <Dropdown.Item>
        <FormattedMessage id="common.string.logout" defaultMessage="Logout" />
      </Dropdown.Item>
    </Dropdown.Menu>
  </Dropdown>
)

export default AccountArea
