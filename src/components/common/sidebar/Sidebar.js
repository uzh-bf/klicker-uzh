import React from 'react'
import PropTypes from 'prop-types'
import { Grid, Menu, Sidebar as SemanticSidebar } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

import SidebarItem from './SidebarItem'
import withCSS from '../../../lib/withCSS'

const Sidebar = ({ activeItem, children, head, visible }) =>
  (<Grid.Row className="noPadding fullHeight">
    {head}

    <Grid.Column className="noPadding">
      <SemanticSidebar.Pushable>
        <SemanticSidebar
          vertical
          as={Menu}
          animation="overlay"
          icon="labeled"
          visible={visible}
          width="wide"
        >
          <SidebarItem
            active={activeItem === 'questionPool'}
            name="questionPool"
            href="/questions/"
          >
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
          <Grid padded>
            {children}
          </Grid>
        </SemanticSidebar.Pusher>
      </SemanticSidebar.Pushable>
    </Grid.Column>
  </Grid.Row>)

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
