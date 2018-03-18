import React from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash/get'
import { intlShape } from 'react-intl'
import { Icon, Menu } from 'semantic-ui-react'
import { graphql } from 'react-apollo'
import { compose, withProps } from 'recompose'

import { AccountSummaryQuery } from '../../../graphql'

import AccountArea from './AccountArea'
import SearchArea from './SearchArea'
import SessionArea from './SessionArea'

const propTypes = {
  accountShort: PropTypes.string,
  // filters: PropTypes.object,
  handleSidebarToggle: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  runningSessionId: PropTypes.string,
  search: PropTypes.shape({
    handleSearch: PropTypes.func.isRequired,
    handleSortByChange: PropTypes.func.isRequired,
    handleSortOrderToggle: PropTypes.func.isRequired,
    sortBy: PropTypes.string.isRequired,
    sortingTypes: PropTypes.arrayOf(
      PropTypes.shape({
        content: PropTypes.string,
        id: PropTypes.string,
        labelStart: PropTypes.string,
      }),
    ).isRequired,
    sortOrder: PropTypes.bool.isRequired,
  }),
  sidebarVisible: PropTypes.bool,
  title: PropTypes.string.isRequired,
}

const defaultProps = {
  accountShort: 'ANON',
  runningSessionId: undefined,
  search: undefined,
  sidebarVisible: false,
}

export const NavbarPres = ({
  accountShort,
  intl,
  search,
  sidebarVisible,
  title,
  handleSidebarToggle,
  runningSessionId,
}) => (
  <div className="navbar">
    <div className="sideArea">
      <Menu borderless className="noBorder">
        <Menu.Item
          icon
          active={sidebarVisible}
          className="sidebar"
          name="sidebar"
          onClick={handleSidebarToggle}
        >
          <Icon name="sidebar" />
        </Menu.Item>
        <h1>{title}</h1>
      </Menu>
    </div>

    {search && (
      <div className="searchArea">
        <SearchArea
          handleSearch={search.handleSearch}
          handleSortByChange={search.handleSortByChange}
          handleSortOrderToggle={search.handleSortOrderToggle}
          intl={intl}
          sortBy={search.sortBy}
          sortOrder={search.sortOrder}
          sortingTypes={search.sortingTypes}
          withSorting={search.withSorting}
        />
      </div>
    )}

    <div className="accountArea">
      <Menu borderless className="loginArea noBorder">
        <Menu.Menu position="right">
          {accountShort && <SessionArea intl={intl} sessionId={runningSessionId} />}
          <AccountArea accountShort={accountShort} />
        </Menu.Menu>
      </Menu>
    </div>

    <style jsx>{`
      @import 'src/theme';
      $background-color: $color-primary-strong;

      .navbar {
        color: $color-white;

        display: flex;
        align-items: center;
        flex-flow: row wrap;
        justify-content: space-between;

        padding: 0;

        background-color: $background-color;

        z-index: 100;

        .sideArea {
          flex: 1;
          order: 0;

          h1 {
            font-size: $font-size-h1;
            margin: 0;
            padding: 0 1rem 0 0.5rem;
            display: flex;
            align-items: center;
            font-weight: bold;
          }

          :global(.sidebar),
          :global(.menu) {
            color: white;
            border-radius: 0;
            font-size: $font-size-h1;
            background-color: $background-color;
          }

          :global(.sidebar.active) {
            background-color: $color-primary-20p;
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
            color: $color-white;

            :global(.item) {
              color: $color-white;
              padding-top: 0;
              padding-bottom: 0;
            }
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

            padding: 0.2rem 1rem;
          }

          .accountArea {
            flex: 0 0 auto;
            order: 2;

            display: initial;

            :global(.item) {
              padding-left: 0.5rem;
              padding-right: 0.5rem;
            }
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
