import React from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash/get'
import { intlShape } from 'react-intl'
import { Icon, Menu } from 'semantic-ui-react'
import { graphql } from 'react-apollo'
import { compose, withProps } from 'recompose'

import { AccountSummaryQuery } from '../../../graphql/queries'

import AccountArea from './AccountArea'
import SearchArea from './SearchArea'
import SessionArea from './SessionArea'

const propTypes = {
  accountShort: PropTypes.string,
  handleSidebarToggle: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  runningSessionId: PropTypes.string.isRequired,
  search: PropTypes.shape({
    handleSearch: PropTypes.func.isRequired,
    handleSort: PropTypes.func.isRequired,
  }),
  sidebarVisible: PropTypes.bool,
  title: PropTypes.string.isRequired,
}

const defaultProps = {
  accountShort: 'ANON',
  search: undefined,
  sidebarVisible: false,
}

export const NavbarPres = ({
  accountShort,
  intl,
  runningSessionId,
  search,
  sidebarVisible,
  title,
  handleSidebarToggle,
}) => (
  <div className="navbar">
    <div className="sideArea">
      <Menu borderless className="noBorder">
        <Menu.Item
          icon
          active={sidebarVisible}
          name="sidebar"
          className="sidebar"
          onClick={handleSidebarToggle}
        >
          <Icon name="sidebar" />
        </Menu.Item>
        <h1>{title}</h1>
      </Menu>
    </div>

    {search && (
      <div className="searchArea">
        <SearchArea intl={intl} handleSearch={search.handleSearch} handleSort={search.handleSort} />
      </div>
    )}

    <div className="accountArea">
      <Menu borderless className="menu noBorder">
        <Menu.Menu position="right">
          <SessionArea sessionId={runningSessionId} />
          <AccountArea accountShort={accountShort} />
        </Menu.Menu>
      </Menu>
    </div>

    <style jsx>{`
      @import 'src/theme';
      $background-color: #f5f5f5;

      .navbar {
        display: flex;
        align-items: center;
        flex-flow: row wrap;
        justify-content: space-between;

        padding: 3px 0 3px 0;

        background-color: $background-color;
        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.3);

        .sideArea {
          flex: 1;
          order: 0;

          h1 {
            font-size: 1.3rem;
            margin: 0;
            padding-left: 1rem;
            display: flex;
            align-items: center;
            background: $background-color;
          }

          :global(.menu) {
            background-color: $background-color;
          }

          :global(.sidebar) {
            border-radius: 0;
            background-color: $background-color;
          }
        }

        .searchArea {
          flex: 0 0 100%;
          order: 1;

          padding: 1rem;
          padding-top: 0.5rem;

          @include desktop-only {
            padding: 0.2rem 3rem;
          }
        }

        .accountArea {
          display: none;

          :global(.menu) {
            background-color: $background-color;
          }
        }

        @include desktop-tablet-only {
          flex-wrap: nowrap;

          .sideArea {
            flex: 0 0 auto;
          }

          .searchArea {
            flex: 1 1 50%;
            order: 1;

            padding: 0.2rem 2rem;
          }

          .accountArea {
            flex: 0 0 auto;
            order: 2;

            display: block;
          }
        }
      }
    `}</style>
  </div>
)

NavbarPres.propTypes = propTypes
NavbarPres.defaultProps = defaultProps

export default compose(
  graphql(AccountSummaryQuery),
  withProps(({ data }) => ({
    accountShort: _get(data, 'user.shortname'),
    runningSessionId: _get(data, 'user.runningSession.id'),
  })),
)(NavbarPres)
