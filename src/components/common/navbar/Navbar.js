import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Button, Divider, Dropdown, Icon, Image, Input, Menu, Popup } from 'semantic-ui-react'

import BaseLayout from '../../layouts/BaseLayout'
import withCSS from '../../../lib/withCSS'

class Navbar extends Component {
  static propTypes = {
    accountShort: PropTypes.string.isRequired, // shorthand for the logged in user
    head: PropTypes.node.isRequired, // head as injected by HOC
    search: PropTypes.bool, // optional search field embedded in navbar
    title: PropTypes.string.isRequired, // title of the page
    handleSearch: PropTypes.func, // function that handles onChange for search field
    handleSidebarToggle: PropTypes.func.isRequired, // function that handles toggling of the sidebar
    handleSort: PropTypes.func, // function that handles changing of sort order
  }

  static defaultProps = {
    search: false,
    handleSearch: f => f,
    handleSort: f => f,
  }

  state = {
    activeItem: 'sidebar',
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
      <BaseLayout columnClasses="navbar">
        {head}

        <Menu borderless as="nav">
          <Menu.Menu className={search ? 'sideAreaWithSearch' : 'sideAreaWithoutSearch'}>
            <Menu.Item
              name="sidebar"
              active={activeItem === 'sidebar'}
              icon
              onClick={this.handleSidebarToggle}
            >
              <Icon name="sidebar" />
            </Menu.Item>
            <Menu.Header as="h1" className="navbarTitle" content={title} />
          </Menu.Menu>

          {search &&
            <Menu.Item fitted className="searchArea">
              <Input className="searchField" icon="search" placeholder="Search..." />
            </Menu.Item>}

          <Menu.Menu className={search ? 'sideAreaWithSearch' : 'sideAreaWithoutSearch'}>
            <Menu.Menu position="right">
              <Popup
                basic
                hideOnScroll
                className="sessionArea"
                on="click"
                position="bottom right"
                trigger={
                  <Menu.Item name="session">
                    /sessions/aw <Icon name="qrcode" />
                  </Menu.Item>
                }
              >
                <Popup.Content>
                  <Image
                    fluid
                    src="http://www.rd.com/wp-content/uploads/sites/2/2016/02/06-train-cat-shake-hands.jpg"
                  />
                  <Divider />
                  <Button fluid primary content="Download" icon="download" />
                </Popup.Content>
              </Popup>
              <Dropdown item simple text={accountShort}>
                <Dropdown.Menu>
                  <Dropdown.Item>Settings</Dropdown.Item>
                  <Dropdown.Item>Logout</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </Menu.Menu>
          </Menu.Menu>
        </Menu>

        <style jsx>{`
          :global(.navbarTitle) {
            font-size: 1.3rem;
            margin-left: 1rem;
          }

          :global(.popup.sessionArea) {
            margin-top: 0 !important;
          }

          :global(.searchArea) {
            border: none;
            text-align: center;
            width: 50%;
          }

          :global(.searchField) {
          }

          :global(.sideAreaWithSearch) {
            width: 25%;
          }

          :global(.sideAreaWithoutSearch) {
            width: 50%;
          }
        `}</style>
        <style jsx global>{`
          .navbar {
            padding: 0 !important;
          }
        `}</style>
      </BaseLayout>
    )
  }
}

export default withCSS(Navbar, [
  'button',
  'divider',
  'dropdown',
  'icon',
  'image',
  'input',
  'menu',
  'popup',
])
