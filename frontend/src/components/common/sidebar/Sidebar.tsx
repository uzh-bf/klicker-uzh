import React from 'react'
import { Menu, Sidebar as SemanticSidebar } from 'semantic-ui-react'
import Image from 'next/image'
import LanguageSwitcher from './LanguageSwitcher'
import KlickerLogoSrc from '../../../../public/KlickerUZH_Gray_Transparent.svg'

interface Props {
  children: React.ReactNode
  visible?: boolean
  items?: React.ReactElement[]
}

const defaultProps = {
  visible: false,
  items: [],
}

function Sidebar({ children, items, visible }: Props): React.ReactElement {
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
          {items}

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
