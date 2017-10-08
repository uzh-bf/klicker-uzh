/* eslint-disable import/no-extraneous-dependencies, react/prop-types */

import React from 'react'
import { storiesOf } from '@storybook/react'
import { action } from '@storybook/addon-actions'
import { compose, withHandlers, withState } from 'recompose'

import { intlMock } from '../../../.storybook/utils'

import ActionButton from './ActionButton'
import ListWithHeader from './ListWithHeader'
import Collapser from './Collapser'

import Navbar from './navbar/Navbar'
import AccountArea from './navbar/AccountArea'
import SearchArea from './navbar/SearchArea'
import { SessionArea } from './navbar/SessionArea'

import Sidebar from './sidebar/Sidebar'
import SidebarItem from './sidebar/SidebarItem'

const sidebarItems = [
  { href: 'i1', label: 'Item 1', name: 'item1' },
  { href: 'i2', label: 'Item 2', name: 'item2' },
]

// create a stateful wrapper for the component
const CollapserWithState = compose(
  withState('collapsed', 'setCollapsed', true),
  withHandlers({
    handleCollapseToggle: ({ setCollapsed }) => () => setCollapsed(collapsed => !collapsed),
  }),
)(Collapser)

// specify some example content
const collapserContent = (
  <div>
    <p>
      hello this is a very short question that is getting longer and longer as we speak. it is in
      fact very very long. the end is even hidden at the beginning.
    </p>

    <p>wow, is this a long question. i could never have imagined seeing such a question.</p>
  </div>
)

storiesOf('common/components', module)
  .add('ActionButton', () => (
    <ActionButton
      items={[
        { handleClick: () => action('click abcd'), label: 'abcd' },
        { handleClick: () => action('click cdef'), label: 'cdef' },
      ]}
    />
  ))
  .add('ListWithHeader', () => (
    <ListWithHeader items={['abcd', 'cdef']}>hello world</ListWithHeader>
  ))
  .add('Collapser', () => (
    <CollapserWithState>
      {collapserContent}
      {collapserContent}
    </CollapserWithState>
  ))
  .add('Collapser (extended)', () => (
    <Collapser handleCollapseToggle={() => action('collapser-clicked')}>
      {collapserContent}
      {collapserContent}
    </Collapser>
  ))

storiesOf('common/navbar', module)
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

storiesOf('common/sidebar', module)
  .add('Sidebar (visible)', () => (
    <Sidebar
      visible
      activeItem="item1"
      items={sidebarItems}
      handleSidebarItemClick={item => action(`click ${item}`)}
    >
      PAGE CONTENT
    </Sidebar>
  ))
  .add('Sidebar (invisible)', () => (
    <Sidebar
      activeItem="item1"
      items={sidebarItems}
      handleSidebarItemClick={item => action(`click ${item}`)}
    >
      PAGE CONTENT
    </Sidebar>
  ))
  .add('SidebarItem', () => (
    <SidebarItem href="bla" name="hello" handleSidebarItemClick={() => action('click')}>
      ITEM CONTENT
    </SidebarItem>
  ))
