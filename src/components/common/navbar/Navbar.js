// @flow

import React from 'react'
import { Icon, Menu } from 'semantic-ui-react'
import { Helmet } from 'react-helmet'
import { createLinks } from '../../../lib'

import AccountArea from './AccountArea'
import SearchArea from './SearchArea'
import SessionArea from './SessionArea'

type Props = {
  accountShort: string,
  intl: $IntlShape,
  search: {
    query: string,
    sortBy: string,
    sortOrder: string,
    handleSearch: (query: string) => mixed,
    handleSort: (by: string, order: string) => mixed,
  },
  sidebarVisible: boolean,
  title: string,
  handleSidebarToggle: () => mixed,
}

const defaultProps = {
  search: undefined,
  sidebarVisible: false,
}

const Navbar = ({
  accountShort,
  intl,
  search,
  sidebarVisible,
  title,
  handleSidebarToggle,
}: Props) =>
  (<div className="navbar">
    <Helmet>
      {createLinks([
        'button',
        'divider',
        'dropdown',
        'icon',
        'image',
        'input',
        'menu',
        'popup',
      ])}
    </Helmet>

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
        <SearchArea intl={intl} handleSearch={search.handleSearch} handleSort={search.handleSort} />
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

          padding: .2rem 2rem;
        }

        .accountArea {
          flex: 0 0 auto;
          order: 2;

          display: block;
        }
      }

      @media all and (min-width: 991px) {
        .searchArea {
          padding: .2rem 3rem;
        }
      }
    `}</style>
  </div>)

Navbar.defaultProps = defaultProps

export default Navbar
