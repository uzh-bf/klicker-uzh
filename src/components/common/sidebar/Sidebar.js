import React from 'react'
import PropTypes from 'prop-types'
import { Dropdown, Menu, Sidebar as SemanticSidebar } from 'semantic-ui-react'
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

const languageOptions = [
  {
    flag: 'gb',
    key: 'en',
    text: 'English',
    value: 'en',
  },
  {
    flag: 'de',
    key: 'de',
    text: 'Deutsch',
    value: 'de',
  },
]

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
        <div className="languageSwitcher">
          <Dropdown selection options={languageOptions} placeholder={'Select Language'} />
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
          text-align: left;
          width: 75% !important;
        }

        .languageSwitcher {
          margin-top: 20rem;
        }

        @include desktop-tablet-only {
          :global(.sidebarMenu) {
            width: 20% !important;
          }
        }

        @include desktop-only {
          :global(.sidebarMenu) {
            width: 15% !important;
          }
        }
      }
    `}</style>
  </div>
)

Sidebar.propTypes = propTypes
Sidebar.defaultProps = defaultProps

export default Sidebar
