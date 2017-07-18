import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Grid, Icon, Menu } from 'semantic-ui-react'

import AccountArea from './AccountArea'
import SearchArea from './SearchArea'
import SessionArea from './SessionArea'
import withCSS from '../../../lib/withCSS'

class Navbar extends Component {
  static propTypes = {
    accountShort: PropTypes.string.isRequired, // shorthand for the logged in user
    head: PropTypes.node.isRequired, // head as injected by HOC
    intl: PropTypes.shape({
      formatMessage: PropTypes.func.isRequired,
    }),
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
    intl: null,
    search: null,
    sidebarVisible: false,
  }

  render() {
    const {
      accountShort,
      head,
      intl,
      search,
      sidebarVisible,
      title,
      handleSidebarToggle,
    } = this.props

    return (
      <Grid.Row className="noPadding">
        {head}

        <Grid.Column className="navbar noPadding">
          <Menu borderless as="nav">
            <Menu.Menu className={search ? 'sideAreaWithSearch' : 'sideAreaWithoutSearch'}>
              <Menu.Item icon active={sidebarVisible} name="sidebar" onClick={handleSidebarToggle}>
                <Icon name="sidebar" />
              </Menu.Item>
              <Menu.Header as="h1" className="navbarTitle" content={title} />
            </Menu.Menu>

            {search && <SearchArea intl={intl} handleSearch={search.handleSearch} />}

            <Menu.Menu className={search ? 'sideAreaWithSearch' : 'sideAreaWithoutSearch'}>
              <Menu.Menu position="right">
                <SessionArea sessionId={accountShort} />
                <AccountArea accountShort={accountShort} />
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
          `}</style>
        </Grid.Column>
      </Grid.Row>
    )
  }
}

// higher order component
// component => wrapped component
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
