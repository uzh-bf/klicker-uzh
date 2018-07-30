import React from 'react'
import PropTypes from 'prop-types'
import { Menu, Icon } from 'semantic-ui-react'

const propTypes = {
  active: PropTypes.bool,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  handleSidebarItemClick: PropTypes.func.isRequired,
  icon: PropTypes.string,
  name: PropTypes.string.isRequired,
}

const defaultProps = {
  active: false,
  className: undefined,
  icon: undefined,
}

const SidebarItem = ({ active, children, className, icon, name, handleSidebarItemClick }) => (
  <Menu.Item active={active} className={className} name={name} onClick={handleSidebarItemClick}>
    {icon && <Icon name={icon} />}
    {children}
  </Menu.Item>
)

SidebarItem.propTypes = propTypes
SidebarItem.defaultProps = defaultProps

export default SidebarItem
