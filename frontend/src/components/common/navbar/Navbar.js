// @flow

import React, { Component } from 'react'
import { Icon, Menu } from 'semantic-ui-react'

import AccountArea from './AccountArea'
import SearchArea from './SearchArea'
import SessionArea from './SessionArea'
import withCSS from '../../../lib/withCSS'

class Navbar extends Component {
  props: {
    accountShort: string,
    handleSidebarToggle: () => mixed,
    head: 'intl/head',
    intl: $IntlShape,
    search: {
      handleSearch: () => mixed,
      handleSort: () => mixed,
      query?: string,
      sortBy?: string,
      sortOrder?: string,
    },
    sidebarVisible: boolean,
    title: string,
  }

  static defaultProps = {
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

            .sideArea {
              flex: 0 0 auto;
            }

            .searchArea {
              flex: 1 1 50%;
              order: 1;

              padding: .5rem 2rem;
            }

            .accountArea {
              flex: 0 0 auto;
              order: 2;

              display: block;
            }
          }

          @media all and (min-width: 991px) {
            .searchArea {
              padding: .5rem 3rem;
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
