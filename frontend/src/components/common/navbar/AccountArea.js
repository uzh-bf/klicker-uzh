import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage } from 'react-intl'
import { Dropdown } from 'semantic-ui-react'

const AccountArea = ({ accountShort }) =>
  (<Dropdown item simple text={accountShort}>
    <Dropdown.Menu>
      <Dropdown.Item>
        <FormattedMessage id="common.string.settings" defaultMessage="Settings" />
      </Dropdown.Item>
      <Dropdown.Item>
        <FormattedMessage id="common.string.logout" defaultMessage="Logout" />
      </Dropdown.Item>
    </Dropdown.Menu>
  </Dropdown>)

AccountArea.propTypes = {
  accountShort: PropTypes.string.isRequired,
}

export default AccountArea
