import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Icon, Menu } from 'semantic-ui-react'

import AccountArea from './AccountArea'
import SearchArea from './SearchArea'
import SessionArea from './SessionArea'
import withCSS from '../../../lib/withCSS'

class Navbar extends Component {
  static propTypes = {
    accountShort: PropTypes.string.isRequired, // shorthand for the logged in user
    handleSidebarToggle: PropTypes.func.isRequired, // function that handles toggling of the sidebar
    head: PropTypes.node.isRequired, // head as injected by HOC
    intl: PropTypes.shape({
      formatMessage: PropTypes.func.isRequired,
    }),
    // optional search field embedded in navbar
    search: PropTypes.shape({
      handleSearch: PropTypes.func.isRequired, // function that handles onChange for search field
      handleSort: PropTypes.func.isRequired, // function that handles changing of sort order
      query: PropTypes.string,
      sortBy: PropTypes.string,
      sortOrder: PropTypes.string,
    }),
    sidebarVisible: PropTypes.bool,
    title: PropTypes.string.isRequired, // title of the page
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
      <div className="navbar">
        {head}

        <div className="sideArea">
          <Menu borderless className="noBorder">
            <Menu.Item icon active={sidebarVisible} name="sidebar" onClick={handleSidebarToggle}>
              <Icon name="sidebar" />
            </Menu.Item>
            <h1>
              {title}
            </h1>
          </Menu>
        </div>

        {search &&
          <div className="searchArea">
            <SearchArea intl={intl} handleSearch={search.handleSearch} />
          </div>}

        <div className="accountArea">
          <Menu borderless className="noBorder">
            <Menu.Menu position="right">
              <SessionArea sessionId={accountShort} />
              <AccountArea accountShort={accountShort} />
            </Menu.Menu>
          </Menu>
        </div>

        <style jsx>{`
          .navbar {
            display: flex;
            align-items: center;
            flex-flow: row wrap;
            justify-content: space-between;

            border-bottom: 1px solid lightgrey;
          }

          h1 {
            // TODO: optimize font sizes
            font-size: 1.3rem;
            margin-left: 1rem;
          }

          .sideArea {
            flex: 1;
            order: 0;
          }

          .searchArea {
            flex: 0 0 100%;
            order: 1;

            padding: 1rem;
            padding-top: .5rem;
          }

          .accountArea {
            display: none;
          }

          @media all and (min-width: 768px) {
            .navbar {
              flex-wrap: nowrap;
            }

            .searchArea {
              flex: 1 1 50%;
              order: 1;

              padding: .5rem;
            }

            .accountArea {
              flex: 1;
              order: 2;

              display: block;
            }
          }
        `}</style>
      </div>
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
