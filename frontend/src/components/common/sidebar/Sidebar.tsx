import React from 'react'
import { Menu, Sidebar as SemanticSidebar } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import SidebarItem from './SidebarItem'
import LanguageSwitcher from './LanguageSwitcher'

interface Props {
  activeItem?: string
  children: React.ReactNode
  handleSidebarItemClick: any
  generic: boolean
  visible?: boolean
  items?: {
    className?: any
    href: string
    label: React.ReactElement
    name: string
    icon?: any
  }[]
  unseenQuestions?: number
  unseenFeedbacks?: number
  isInteractionEnabled?: boolean
}

const defaultProps = {
  activeItem: 'questionPool',
  visible: false,
}

function Sidebar({
  activeItem,
  children,
  items,
  visible,
  generic,
  handleSidebarItemClick,
  unseenQuestions,
  unseenFeedbacks,
  isInteractionEnabled,
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
          {generic &&
            items.map(
              ({ name, className, href, icon, label }): React.ReactElement => (
                <SidebarItem
                  active={name === activeItem}
                  className={className}
                  handleSidebarItemClick={handleSidebarItemClick(href)}
                  generic={generic}
                  icon={icon}
                  key={name}
                  name={name}
                >
                  {label}
                </SidebarItem>
              )
            )}
          {!generic && (
            <SidebarItem
              active={activeItem === 'activeQuestion'}
              // className={items[0].className}
              handleSidebarItemClick={handleSidebarItemClick('activeQuestion')}
              generic={generic}
              icon="question"
              key="activeQuestion"
              name="activeQuestion"
              unseenItems={unseenQuestions}
            >
              <FormattedMessage defaultMessage="Active Question" id="joinSession.sidebar.activeQuestion" />
            </SidebarItem>
          )}
          {!generic && isInteractionEnabled && (
            <SidebarItem
              active={activeItem === 'feedbackChannel'}
              // className={items[1].className}
              handleSidebarItemClick={handleSidebarItemClick('feedbackChannel')}
              generic={generic}
              icon="talk"
              key="feedbackChannel"
              name="feedbackChannel"
              unseenItems={unseenFeedbacks}
            >
              <FormattedMessage defaultMessage="Feedback-Channel" id="joinSession.sidebar.feedbackChannel" />
            </SidebarItem>
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
