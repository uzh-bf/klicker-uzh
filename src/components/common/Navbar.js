import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Dropdown, Icon, Menu } from 'semantic-ui-react'

import BaseLayout from '../layouts/BaseLayout'
import withCSS from '../../lib/withCSS'

class Navbar extends Component {
  static propTypes = {
    accountShort: PropTypes.string.isRequired, // shorthand for the logged in user
    head: PropTypes.node.isRequired,
    search: PropTypes.bool, // optional search field embedded in navbar
    title: PropTypes.string.isRequired, // title of the page
    handleSearch: PropTypes.func,
    handleSidebarToggle: PropTypes.func.isRequired,
    handleSort: PropTypes.func,
  }

  static defaultProps = {
    search: false,
    handleSearch: f => f,
    handleSort: f => f,
  }

  state = {
    sortBy: 'name',
    sortOrder: 'asc',
  }

  render() {
    const {
      accountShort,
      head,
      search,
      title,
      handleSearch,
      handleSidebarToggle,
      handleSort,
    } = this.props
    const { activeItem } = this.state

    return (
      <BaseLayout>
        {head}

        <Menu fluid as="nav">
          <Menu.Item
            name="sidebar"
            active={activeItem === 'sidebar'}
            icon
            onClick={this.handleSidebarToggle}
          >
            <Icon name="sidebar" />
          </Menu.Item>
          <Menu.Header as="h1" className="navbarTitle" content={title} />

          <Menu.Menu position="right">
            <Dropdown item text={accountShort} simple>
              <Dropdown.Menu>
                <Dropdown.Item>Settings</Dropdown.Item>
                <Dropdown.Item>Logout</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </Menu.Menu>
        </Menu>

        <style jsx>{`
          :global(.navbarTitle) {
            font-size: 1.2rem;
            margin-left: 1rem;
          }
        `}</style>
      </BaseLayout>
    )
  }
}

export default withCSS(Navbar, ['dropdown', 'icon', 'menu'])
