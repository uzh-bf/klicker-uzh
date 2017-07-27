import React from 'react'
import PropTypes from 'prop-types'
import Router from 'next/router'
import { Menu } from 'semantic-ui-react'

const SidebarItem = ({ active, children, href, name }) =>
  (<Menu.Item active={active} name={name} onClick={() => Router.push(href)}>
    {children}
  </Menu.Item>)

SidebarItem.propTypes = {
  active: PropTypes.bool,
  children: PropTypes.node.isRequired,
  href: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
}

SidebarItem.defaultProps = {
  active: false,
}

export default SidebarItem
