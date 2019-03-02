/* eslint-disable react/prop-types, no-undef, no-underscore-dangle */

import * as React from 'react'
import getConfig from 'next/config'
import Router from 'next/router'
import _get from 'lodash/get'
import { InjectedIntlProps } from 'react-intl'
import { Icon, Menu } from 'semantic-ui-react'
import { Query, Mutation } from 'react-apollo'

import AccountArea from './AccountArea'
import SearchArea from './SearchArea'
import SessionArea from './SessionArea'
import { AccountSummaryQuery, LogoutMutation } from '../../../graphql'

interface KlickerWindow extends Window {
  INIT_LR?: string
  INIT_RAVEN?: string
  _slaask?: any
}

declare const window: KlickerWindow

const { publicRuntimeConfig } = getConfig()

interface Props extends InjectedIntlProps {
  search?: {
    handleSearch: any
    handleSortByChange: any
    handleSortOrderToggle: any
    sortBy: string
    sortingTypes: {
      content: string
      id: string
      labelStart: string
    }[]
    sortOrder: boolean
    withSorting: boolean
  }
  handleSidebarToggle: () => void
  sidebarVisible?: boolean
  title: string
}

const defaultProps = {
  search: undefined,
  sidebarVisible: false,
}

export const NavbarPres: React.FunctionComponent<Props> = ({
  intl,
  search,
  sidebarVisible,
  title,
  handleSidebarToggle,
}): React.ReactElement<any> => (
  <div className="navbar">
    <div className="sideArea">
      <Menu borderless className="noBorder">
        <Menu.Item icon active={sidebarVisible} className="sidebar" name="sidebar" onClick={handleSidebarToggle}>
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
          const accountId = _get(data, 'user.id')
          const userEmail = _get(data, 'user.email')
          const accountShort = _get(data, 'user.shortname')
          // const userHash = _get(data, 'user.hmac')
          const runningSessionId = _get(data, 'user.runningSession.id')

          if (typeof window !== 'undefined') {
            if (window.INIT_LR) {
              try {
                const LogRocket = require('logrocket')

                LogRocket.identify(accountId, {
                  email: userEmail,
                  name: accountShort,
                })
              } catch (e) {
                //
              }
            }

            if (typeof window._slaask !== 'undefined') {
              try {
                window._slaask.identify({
                  email: userEmail,
                  id: accountId,
                  shortname: accountShort,
                  // user_hash: userHash,
                })
                window._slaask.init(publicRuntimeConfig.slaaskWidgetKey, accountId)
                /* window._slaask.init(process.env.SLAASK_WIDGET_KEY, {
                  user_hash: userHash,
                  user_token: accountId,
                }) */
              } catch (e) {
                //
              }
            }

            if (window.INIT_RAVEN) {
              try {
                const Raven = require('raven-js')
                Raven.identify(accountId, {
                  name: accountShort,
                })
              } catch (e) {
                //
              }
            }
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

NavbarPres.defaultProps = defaultProps

export default NavbarPres
