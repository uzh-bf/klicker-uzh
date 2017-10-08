import React from 'react'
import PropTypes from 'prop-types'
import { Dropdown } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import { graphql } from 'react-apollo'
import { compose, mapProps } from 'recompose'
import _get from 'lodash/get'

import { AccountSummaryQuery } from '../../../queries/queries'

const propTypes = {
  accountShort: PropTypes.string.isRequired,
}

export const AccountAreaPres = ({ accountShort }) => (
  <Dropdown item simple text={accountShort.toUpperCase()}>
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

AccountAreaPres.propTypes = propTypes

export default compose(
  graphql(AccountSummaryQuery),
  mapProps(({ data }) => ({
    accountShort: _get(data, 'user.shortname') || 'ANON',
  })),
)(AccountAreaPres)
