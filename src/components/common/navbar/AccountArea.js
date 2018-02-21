import React from 'react'
import PropTypes from 'prop-types'
import { Dropdown } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

const propTypes = {
  accountShort: PropTypes.string.isRequired,
}

const AccountArea = ({ accountShort }) => (
  <React.Fragment>
    <Dropdown disabled item simple icon="user" text={accountShort.toUpperCase()}>
      <Dropdown.Menu>
        {/* <Dropdown.Item disabled>
          <FormattedMessage defaultMessage="Settings" id="common.string.settings" />
        </Dropdown.Item> */}
        <Dropdown.Item>
          <FormattedMessage defaultMessage="Logout" id="common.string.logout" />
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  </React.Fragment>
)

AccountArea.propTypes = propTypes

export default AccountArea
