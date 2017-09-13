// @flow

import React from 'react'
import { Menu, Sidebar as SemanticSidebar } from 'semantic-ui-react'

import SidebarItem from './SidebarItem'

type Props = {
  activeItem: string,
  children: any,
  items: Array<{
    label: string | React.Element<*>,
    href: string,
    name: string,
  }>,
  visible: boolean,
  handleSidebarItemClick: (href: string) => () => mixed,
}

const defaultProps = {
  activeItem: 'questionPool',
  visible: false,
}

const Sidebar = ({ activeItem, children, items, visible, handleSidebarItemClick }: Props) => (
  <div className="sidebar">
    <SemanticSidebar.Pushable>
      <SemanticSidebar
        vertical
        as={Menu}
        animation="overlay"
        className="sidebarMenu"
        icon="labeled"
        visible={visible}
        width="wide"
      >
        {items.map(item => (
          <SidebarItem
            key={item.name}
            active={item.name === activeItem}
            name={item.name}
            href={item.href}
            handleSidebarItemClick={handleSidebarItemClick}
          >
            {item.label}
          </SidebarItem>
        ))}
      </SemanticSidebar>

      <SemanticSidebar.Pusher>{children}</SemanticSidebar.Pusher>
    </SemanticSidebar.Pushable>

    <style jsx>{`
      .sidebar {
        display: flex;
        flex-direction: column;

        width: 100%;
      }

      :global(.sidebarMenu) {
        text-align: left;
        width: 75% !important;
      }

      @media all and (min-width: 768px) {
        :global(.sidebarMenu) {
          width: 20% !important;
        }
      }

      @media all and (min-width: 991px) {
        :global(.sidebarMenu) {
          width: 15% !important;
        }
      }
    `}</style>
  </div>
)

Sidebar.defaultProps = defaultProps

export default Sidebar
