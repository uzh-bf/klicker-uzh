import React from 'react'
import PropTypes from 'prop-types'
import { Menu } from 'semantic-ui-react'

const propTypes = {
  active: PropTypes.boolean,
  children: PropTypes.children.isRequired,
  handleSidebarItemClick: PropTypes.func.isRequired,
  href: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
}

const defaultProps = {
  active: false,
}

const SidebarItem = ({ active, children, href, name, handleSidebarItemClick }) => (
  <Menu.Item active={active} name={name} onClick={handleSidebarItemClick(href)}>
    {children}
  </Menu.Item>
)

SidebarItem.propTypes = propTypes
SidebarItem.defaultProps = defaultProps

export default SidebarItem
