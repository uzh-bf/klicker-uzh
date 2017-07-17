import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Button, Divider, Dropdown, Grid, Icon, Image, Input, Menu, Popup } from 'semantic-ui-react'

import withCSS from '../../lib/withCSS'

class Navbar extends Component {
  static propTypes = {
    accountShort: PropTypes.string.isRequired, // shorthand for the logged in user
    head: PropTypes.node.isRequired, // head as injected by HOC
    sidebarVisible: PropTypes.bool,

    // optional search field embedded in navbar
    search: PropTypes.shape({
      handleSearch: PropTypes.func.isRequired, // function that handles onChange for search field
      handleSort: PropTypes.func.isRequired, // function that handles changing of sort order
      query: PropTypes.string,
      sortBy: PropTypes.string,
      sortOrder: PropTypes.string,
    }),

    title: PropTypes.string.isRequired, // title of the page
    handleSidebarToggle: PropTypes.func.isRequired, // function that handles toggling of the sidebar
  }

  static defaultProps = {
    search: {
      query: '',
      sortBy: 'id',
      sortOrder: 'asc',
    },
    sidebarVisible: false,
  }

  render() {
    const { accountShort, head, search, sidebarVisible, title, handleSidebarToggle } = this.props

    return (
      <Grid.Row className="noPadding">
        {head}

        <Grid.Column className="navbar noPadding">
          <Menu borderless as="nav">
            <Menu.Menu className={search ? 'sideAreaWithSearch' : 'sideAreaWithoutSearch'}>
              <Menu.Item name="sidebar" active={sidebarVisible} icon onClick={handleSidebarToggle}>
                <Icon name="sidebar" />
              </Menu.Item>
              <Menu.Header as="h1" className="navbarTitle" content={title} />
            </Menu.Menu>

            {search &&
              <Menu.Item fitted className="searchArea">
                <Input
                  className="searchField"
                  icon="search"
                  placeholder="Search..."
                  onChange={search.handleSearch}
                />
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

          <style jsx global>{`
            .navbarTitle {
              font-size: 1.3rem;
              margin-left: 1rem;
            }

            .popup.sessionArea {
              margin-top: 0 !important;
            }

            .searchArea {
              border: none;
              text-align: center;
              width: 50%;
            }

            .sideAreaWithSearch {
              width: 25%;
            }

            .sideAreaWithoutSearch {
              width: 50%;
            }
            .navbar {
              padding: 0 !important;
            }
          `}</style>
        </Grid.Column>
      </Grid.Row>
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
