import React from 'react'
import PropTypes from 'prop-types'
import { Menu, Sidebar as SemanticSidebar } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

import SidebarItem from './SidebarItem'
import withCSS from '../../../lib/withCSS'

const Sidebar = ({ activeItem, children, head, visible }) =>
  (<div className="sidebar">
    {head}

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
        <SidebarItem active={activeItem === 'questionPool'} name="questionPool" href="/questions/">
          <FormattedMessage id="pages.questionPool.title" defaultMessage="Question Pool" />
        </SidebarItem>

        <SidebarItem
          active={activeItem === 'sessionHistory'}
          name="sessionHistory"
          href="/sessions/"
        >
          <FormattedMessage id="pages.sessionHistory.title" defaultMessage="Session History" />
        </SidebarItem>

        <SidebarItem
          active={activeItem === 'runningSession'}
          name="runningSession"
          href="/sessions/running"
        >
          <FormattedMessage id="pages.runningSession.title" defaultMessage="Running Session" />
        </SidebarItem>
      </SemanticSidebar>

      <SemanticSidebar.Pusher>
        {children}
      </SemanticSidebar.Pusher>
    </SemanticSidebar.Pushable>

    <style jsx>{`
      .sidebar {
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
  </div>)

Sidebar.propTypes = {
  activeItem: PropTypes.string,
  children: PropTypes.node.isRequired,
  head: PropTypes.node.isRequired,
  visible: PropTypes.bool.isRequired,
}

Sidebar.defaultProps = {
  activeItem: 'questionPool',
}

export default withCSS(Sidebar, ['menu', 'sidebar'])
