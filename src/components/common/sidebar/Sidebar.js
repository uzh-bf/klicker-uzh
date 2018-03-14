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
            icon={item.icon}
            key={item.name}
            name={item.name}
          >
            {item.label}
          </SidebarItem>
        ))}
        <div className="extras">
          <div className="langSwitcher">
            <LanguageSwitcher />
          </div>
          <div className="logo">
            Klicker<span className="high">UZH</span>
          </div>
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
          width: 75% !important;

          display: flex !important;
          flex-direction: column;

          .extras {
            display: flex;
            flex-direction: column;

            justify-content: space-between;
          }

          .langSwitcher {
            padding: 1rem;
          }

          .logo {
            padding: 2rem 1rem;
            font-size: 2rem;
            line-height: 2rem;

            .high {
              font-size: 1rem;
              line-height: 1rem;
              vertical-align: top;
            }
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
