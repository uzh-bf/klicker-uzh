import React from 'react'
import { Menu, Sidebar as SemanticSidebar } from 'semantic-ui-react'
import LanguageSwitcher from './LanguageSwitcher'
import SidebarItem from './SidebarItem'

interface Props {
  activeItem?: string
  children: React.ReactNode
  handleSidebarItemClick: any
  items?: {
    className?: any
    href: string
    label: React.ReactElement
    name: string
    icon?: any
  }[]
  visible?: boolean
}

const defaultProps = {
  activeItem: 'questionPool',
  items: [],
  visible: false,
}

function Sidebar({ activeItem, children, items, visible, handleSidebarItemClick }: Props): React.ReactElement {
  return (
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
          {items.map(
            ({ name, className, href, icon, label }): React.ReactElement => (
              <SidebarItem
                active={name === activeItem}
                className={className}
                handleSidebarItemClick={handleSidebarItemClick(href)}
                icon={icon}
                key={name}
                name={name}
              >
                {label}
              </SidebarItem>
            )
          )}
          <div className="extras">
            <div className="langSwitcher">
              <LanguageSwitcher />
            </div>
            <div className="logo">
              Klicker
              <span className="high">UZH</span>
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
              color: $color-primary-strong;
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
}

Sidebar.defaultProps = defaultProps

export default Sidebar
