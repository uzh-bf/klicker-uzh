import React from 'react'
import { Menu, Sidebar as SemanticSidebar } from 'semantic-ui-react'
import SidebarItem from './SidebarItem'
import LanguageSwitcher from './LanguageSwitcher'

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
  unseenQuestions: number
  unseenFeedbacks: number
}

const defaultProps = {
  activeItem: 'questionPool',
  items: [],
  visible: false,
}

function Sidebar({
  activeItem,
  children,
  items,
  visible,
  handleSidebarItemClick,
  unseenQuestions,
  unseenFeedbacks,
}: Props): React.ReactElement {
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
          <SidebarItem
            active={items[0].name === activeItem}
            className={items[0].className}
            handleSidebarItemClick={handleSidebarItemClick(items[0].href)}
            icon={items[0].icon}
            key={items[0].name}
            name={items[0].name}
            unseenItems={unseenQuestions}
          >
            {items[0].label}
          </SidebarItem>
          <SidebarItem
            active={items[1].name === activeItem}
            className={items[1].className}
            handleSidebarItemClick={handleSidebarItemClick(items[1].href)}
            icon={items[1].icon}
            key={items[1].name}
            name={items[1].name}
            unseenItems={unseenFeedbacks}
          >
            {items[1].label}
          </SidebarItem>

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
