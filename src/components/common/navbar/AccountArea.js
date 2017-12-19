import React from 'react'
import PropTypes from 'prop-types'
import { Dropdown } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import Link from 'next/link'

const propTypes = {
  accountShort: PropTypes.string.isRequired,
}

const AccountArea = ({ accountShort }) => (
  <Dropdown item simple text={accountShort.toUpperCase()}>
    <Dropdown.Menu>
      <Link href="/user/settings">
        <Dropdown.Item>
          <FormattedMessage defaultMessage="Settings" id="common.string.settings" />
        </Dropdown.Item>
      </Link>
      <Dropdown.Item disabled>
        <FormattedMessage defaultMessage="Logout" id="common.string.logout" />
      </Dropdown.Item>
    </Dropdown.Menu>
  </Dropdown>
)

AccountArea.propTypes = propTypes

export default AccountArea
