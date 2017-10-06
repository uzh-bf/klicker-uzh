/* eslint-disable import/no-extraneous-dependencies */

import React from 'react'
import { storiesOf } from '@storybook/react'
import { action } from '@storybook/addon-actions'

import Sidebar from './Sidebar'
import SidebarItem from './SidebarItem'

const items = [
  { href: 'i1', label: 'Item 1', name: 'item1' },
  { href: 'i2', label: 'Item 2', name: 'item2' },
]

storiesOf('Sidebar', module)
  .add('Sidebar (visible)', () => (
    <Sidebar
      visible
      activeItem="item1"
      items={items}
      handleSidebarItemClick={item => action(`click ${item}`)}
    >
      PAGE CONTENT
    </Sidebar>
  ))
  .add('Sidebar (invisible)', () => (
    <Sidebar
      activeItem="item1"
      items={items}
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
