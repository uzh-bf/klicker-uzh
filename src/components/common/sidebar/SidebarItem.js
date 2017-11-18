import React from 'react'
import PropTypes from 'prop-types'
import { Menu } from 'semantic-ui-react'

const propTypes = {
  active: PropTypes.bool,
  children: PropTypes.node.isRequired,
  handleSidebarItemClick: PropTypes.func.isRequired,
  name: PropTypes.string.isRequired,
}

const defaultProps = {
  active: false,
}

const SidebarItem = ({
  active, children, name, handleSidebarItemClick,
}) => (
  <Menu.Item active={active} name={name} onClick={handleSidebarItemClick}>
    {children}
  </Menu.Item>
)

SidebarItem.propTypes = propTypes
SidebarItem.defaultProps = defaultProps

export default SidebarItem
