/* eslint-disable import/no-extraneous-dependencies, react/prop-types */

import React from 'react'
import { storiesOf } from '@storybook/react'
import { action } from '@storybook/addon-actions'
import { compose, withHandlers, withState } from 'recompose'

import { intlMock } from '../../../.storybook/utils'

import { ActionButton, ActionMenu, Button, ListWithHeader, Collapser } from '.'
import { AccountArea, SearchArea, SessionArea, NavbarPres } from './navbar'
import { Sidebar, SidebarItem, LanguageSwitcher } from './sidebar'

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
  .add('ActionMenu', () => (
    <ActionMenu items={[{ done: false }, { done: true }]} setActiveIndex={f => f} />
  ))
  .add('Button', () => <Button>Hello World!</Button>)
  .add('Button (active)', () => <Button active>Hello World!</Button>)
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
  .add('ListWithHeader', () => (
    <ListWithHeader items={['abcd', 'cdef']}>hello world</ListWithHeader>
  ))

storiesOf('common/navbar', module)
  .add('Navbar', () => (
    <NavbarPres
      accountShort="AW"
      intl={intlMock}
      runningSessionId="a2sd5"
      search={{
        handleSearch: query => action(`search ${query}`),
        handleSort: () => action('sort'),
      }}
      title="Example page"
    />
  ))
  .add('AccountArea', () => <AccountArea accountShort="AW" />)
  .add('SearchArea', () => (
    <SearchArea handleSearch={query => action(`search ${query}`)} intl={intlMock} />
  ))
  .add('SessionArea', () => <SessionArea sessionId="a7s7d" />)

storiesOf('common/sidebar', module)
  .add('Sidebar (visible)', () => (
    <Sidebar
      visible
      activeItem="item1"
      handleSidebarItemClick={item => action(`click ${item}`)}
      items={sidebarItems}
    >
      PAGE CONTENT
    </Sidebar>
  ))
  .add('Sidebar (invisible)', () => (
    <Sidebar
      activeItem="item1"
      handleSidebarItemClick={item => action(`click ${item}`)}
      items={sidebarItems}
    >
      PAGE CONTENT
    </Sidebar>
  ))
  .add('SidebarItem', () => (
    <SidebarItem handleSidebarItemClick={() => action('click')} href="bla" name="hello">
      ITEM CONTENT
    </SidebarItem>
  ))
  .add('LanguageSwitcher', () => <LanguageSwitcher />)
