import React from 'react'
import PropTypes from 'prop-types'
import { Menu, Sidebar as SemanticSidebar } from 'semantic-ui-react'
import SidebarItem from './SidebarItem'
import LanguageSwitcher from './LanguageSwitcher'

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

const Sidebar = ({
  activeItem, children, items, visible, handleSidebarItemClick,
}) => (
  <div className="sidebar">
    <SemanticSidebar.Pushable>
      <SemanticSidebar
        vertical
        animation="overlay"
        as={Menu}
        className="sidebarMenu"
        icon="labeled"
        visible={visible}
        width="wide"
      >
        {items.map(item => (
          <SidebarItem
            active={item.name === activeItem}
            handleSidebarItemClick={handleSidebarItemClick(item.href)}
            key={item.name}
            name={item.name}
          >
            {item.label}
          </SidebarItem>
        ))}
        <div className="langSwitcher">
          <LanguageSwitcher />
        </div>
      </SemanticSidebar>
      <SemanticSidebar.Pusher>{children}</SemanticSidebar.Pusher>
    </SemanticSidebar.Pushable>

    <style jsx>{`
      @import 'src/theme';

      .sidebar {
        width: 100%;

        :global(.pusher) {
          height: 100%;
        }

        :global(.sidebarMenu) {
          position: relative;
          text-align: left;
          width: 75% !important;

          .langSwitcher {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
          }

          @include desktop-tablet-only {
            width: 15rem !important;
          }
        }
      }
    `}</style>
  </div>
)

Sidebar.propTypes = propTypes
Sidebar.defaultProps = defaultProps

export default Sidebar
