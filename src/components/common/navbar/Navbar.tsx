/* eslint-disable react/prop-types, no-undef, no-underscore-dangle */

import * as React from 'react'
import getConfig from 'next/config'
import { useRouter } from 'next/router'
import _get from 'lodash/get'
import { Icon, Menu } from 'semantic-ui-react'
import { useQuery, useMutation } from '@apollo/client'

import AccountArea from './AccountArea'
import SearchArea from './SearchArea'
import SessionArea from './SessionArea'
import LogoutMutation from '../../../graphql/mutations/LogoutMutation.graphql'
import AccountSummaryQuery from '../../../graphql/queries/AccountSummaryQuery.graphql'

interface KlickerWindow extends Window {
  INIT_LR?: boolean
  _slaask?: any
}

declare const window: KlickerWindow

const { publicRuntimeConfig } = getConfig()

interface Props {
  actions?: any[]
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
  actions: [],
  search: undefined,
  sidebarVisible: false,
}

function Navbar({ actions, search, sidebarVisible, title, handleSidebarToggle }: Props): React.ReactElement {
  const router = useRouter()

  const [logout] = useMutation(LogoutMutation)
  const { data } = useQuery(AccountSummaryQuery)

  return (
    <div className="navbar">
      <div className="sideArea">
        <Menu borderless className="noBorder">
          <Menu.Item icon active={sidebarVisible} className="sidebar" name="sidebar" onClick={handleSidebarToggle}>
            <Icon name="sidebar" />
          </Menu.Item>
          <h1>{title}</h1>
        </Menu>
      </div>

      {actions && <div className="actionArea">{actions}</div>}

      {search && (
        <div className="searchArea">
          <SearchArea
            handleSearch={search.handleSearch}
            handleSortByChange={search.handleSortByChange}
            handleSortOrderToggle={search.handleSortOrderToggle}
            sortBy={search.sortBy}
            sortingTypes={search.sortingTypes}
            sortOrder={search.sortOrder}
            withSorting={search.withSorting}
          />
        </div>
      )}

      <div className="accountArea">
        {((): React.ReactElement => {
          const accountId = _get(data, 'user.id')
          const userEmail = _get(data, 'user.email')
          const accountShort = _get(data, 'user.shortname')
          // const userHash = _get(data, 'user.hmac')
          const role = _get(data, 'user.role')
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

            if (publicRuntimeConfig.sentryDSN) {
              try {
                const Sentry = require('@sentry/browser')
                Sentry.setUser({ id: accountId, username: accountShort })
              } catch (e) {
                //
              }
            }
          }

          return (
            <Menu borderless className="loginArea noBorder">
              <Menu.Menu position="right">
                {accountShort && <SessionArea sessionId={runningSessionId} />}

                <AccountArea
                  accountShort={accountShort}
                  role={role}
                  onLogout={async (): Promise<void> => {
                    // logout
                    await logout()

                    // redirect to the landing page
                    router.push('/')
                  }}
                />
              </Menu.Menu>
            </Menu>
          )
        })()}
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

            :global(.menu),
            :global(.ui.dropdown .menu > .item) {
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
}

Navbar.defaultProps = defaultProps

export default Navbar
