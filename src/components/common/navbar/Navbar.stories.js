/* eslint-disable import/no-extraneous-dependencies */

import React from 'react'
import { storiesOf } from '@storybook/react'
import { action } from '@storybook/addon-actions'

import Navbar from './Navbar'
import AccountArea from './AccountArea'
import SearchArea from './SearchArea'
import SessionArea from './SessionArea'

import { intlMock } from '../../../../.storybook/utils'

storiesOf('navbar', module)
  .add('Navbar', () => (
    <Navbar
      accountShort="AW"
      intl={intlMock}
      search={{
        handleSearch: query => action(`search ${query}`),
        handleSort: () => action('sort'),
      }}
      title="Example page"
    />
  ))
  .add('AccountArea', () => <AccountArea accountShort="AW" />)
  .add('SearchArea', () => (
    <SearchArea intl={intlMock} handleSearch={query => action(`search ${query}`)} />
  ))
  .add('SessionArea', () => <SessionArea sessionId="AW" />)
