import React from 'react'
import PropTypes from 'prop-types'
import { intlShape } from 'react-intl'
import { Icon, Menu } from 'semantic-ui-react'
import { Query, Mutation } from 'react-apollo'
import Router from 'next/router'

import { AccountSummaryQuery, LogoutMutation } from '../../../graphql'

import AccountArea from './AccountArea'
import SearchArea from './SearchArea'
import SessionArea from './SessionArea'

const propTypes = {
  // filters: PropTypes.object,
  handleSidebarToggle: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
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
  search: undefined,
  sidebarVisible: false,
}

export const NavbarPres = ({
  intl, search, sidebarVisible, title, handleSidebarToggle,
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
      <Query query={AccountSummaryQuery}>
        {({ data }) => {
          const accountId = data.user?.id
          const accountShort = data.user?.shortname
          const runningSessionId = data.user?.runningSession?.id

          // identify in logrocket
          if (typeof window !== 'undefined' && window.INIT_LR && window.LogRocket) {
            window.LogRocket.identify(accountId, {
              name: accountShort,
            })
          }

          return (
            <Menu borderless className="loginArea noBorder">
              <Menu.Menu position="right">
                {accountShort && <SessionArea intl={intl} sessionId={runningSessionId} />}

                <Mutation mutation={LogoutMutation}>
                  {logout => (
                    <AccountArea
                      accountShort={accountShort}
                      onLogout={async () => {
                        // logout
                        await logout()

                        // redirect to the landing page
                        Router.push('/')
                      }}
                    />
                  )}
                </Mutation>
              </Menu.Menu>
            </Menu>
          )
        }}
      </Query>
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
            color: $color-white;
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

export default NavbarPres
