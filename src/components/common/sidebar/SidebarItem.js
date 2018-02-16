import React from 'react'
import PropTypes from 'prop-types'
import { Menu } from 'semantic-ui-react'

const propTypes = {
  active: PropTypes.bool,
  children: PropTypes.node.isRequired,
  handleSidebarItemClick: PropTypes.func.isRequired,
  icon: PropTypes.string,
  name: PropTypes.string.isRequired,
}

const defaultProps = {
  active: false,
  icon: undefined,
}

const SidebarItem = ({
  active, children, icon, name, handleSidebarItemClick,
}) => (
  <Menu.Item active={active} icon={icon} name={name} onClick={handleSidebarItemClick}>
    {children}
  </Menu.Item>
)

SidebarItem.propTypes = propTypes
SidebarItem.defaultProps = defaultProps

export default SidebarItem
