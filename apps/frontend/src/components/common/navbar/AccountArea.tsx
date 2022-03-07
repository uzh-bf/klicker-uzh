import Link from 'next/link'
import { Icon, Dropdown } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

import { ROLES } from '../../../constants'

interface Props {
  accountShort?: string
  role?: string
  onLogout: any
}

const defaultProps = {
  accountShort: '-',
  role: ROLES.USER,
}

function AccountArea({ accountShort, role, onLogout }: Props) {
  return (
    <Dropdown item icon="user" text={`${accountShort} `}>
      <Dropdown.Menu className="!bg-white">
        <Link href="/user/settings">
          <Dropdown.Item>
            <Icon name="settings" />
            <FormattedMessage defaultMessage="Settings" id="common.string.settings" />
          </Dropdown.Item>
        </Link>
        {role === ROLES.ADMIN && (
          <Link href="/user/admin">
            <Dropdown.Item>
              <Icon name="id badge" />
              <FormattedMessage defaultMessage="Admin" id="common.string.admin" />
            </Dropdown.Item>
          </Link>
        )}
        <Dropdown.Item onClick={onLogout}>
          <Icon name="log out" />
          <FormattedMessage defaultMessage="Logout" id="common.string.logout" />
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  )
}

AccountArea.defaultProps = defaultProps

export default AccountArea
