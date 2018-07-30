import React from 'react'
import PropTypes from 'prop-types'
import Link from 'next/link'
import { Icon, Dropdown } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

const propTypes = {
  accountShort: PropTypes.string,
  onLogout: PropTypes.func.isRequired,
}

const defaultProps = {
  accountShort: '-',
}

const AccountArea = ({ accountShort, onLogout }) => (
  <Dropdown item simple icon="user" text={`${accountShort} `}>
    <Dropdown.Menu>
      <Link href="/user/settings">
        <Dropdown.Item>
          <Icon name="settings" />
          <FormattedMessage
            defaultMessage="Settings"
            id="common.string.settings"
          />
        </Dropdown.Item>
      </Link>
      <Dropdown.Item onClick={onLogout}>
        <Icon name="log out" />
        <FormattedMessage defaultMessage="Logout" id="common.string.logout" />
      </Dropdown.Item>
    </Dropdown.Menu>
  </Dropdown>
)

AccountArea.propTypes = propTypes
AccountArea.defaultProps = defaultProps

export default AccountArea
