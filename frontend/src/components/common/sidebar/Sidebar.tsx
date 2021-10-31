import React from 'react'
import { Menu, Sidebar as SemanticSidebar } from 'semantic-ui-react'
import Image from 'next/image'
import SidebarItem from './SidebarItem'
import LanguageSwitcher from './LanguageSwitcher'
import KlickerLogoSrc from '../../../../public/KlickerUZH_Gray_Transparent.svg'

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
          <div className="flex flex-col justify-between h-full">
            <div className="p-4">
              <LanguageSwitcher />
            </div>
            <div className="p-4">
              <Image alt="KlickerUZH Logo" src={KlickerLogoSrc} />
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
