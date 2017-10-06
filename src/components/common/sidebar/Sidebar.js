import React from 'react'
import PropTypes from 'prop-types'
import { Menu, Sidebar as SemanticSidebar } from 'semantic-ui-react'

import SidebarItem from './SidebarItem'

const propTypes = {
  activeItem: PropTypes.string,
  children: PropTypes.node.isRequired,
  handleSidebarItemClick: PropTypes.func.isRequired,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      href: PropTypes.string.isRequired,
      label: PropTypes.element.isRequired,
      name: PropTypes.string.isRequired,
    }),
  ),
  visible: PropTypes.bool,
}

const defaultProps = {
  activeItem: 'questionPool',
  items: [],
  visible: false,
}

const Sidebar = ({ activeItem, children, items, visible, handleSidebarItemClick }) => (
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

        height: 100%;
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

Sidebar.propTypes = propTypes
Sidebar.defaultProps = defaultProps

export default Sidebar
