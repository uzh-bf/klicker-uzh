import React from 'react'
import PropTypes from 'prop-types'
import Router from 'next/router'
import { Grid, Menu, Sidebar as SemanticSidebar } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

import withCSS from '../../lib/withCSS'

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
          <Menu.Item
            active={activeItem === 'questionPool'}
            name="questionPool"
            onClick={() => Router.push('/questions/')}
          >
            <FormattedMessage id="pages.questionPool.title" defaultMessage="Question Pool" />
          </Menu.Item>
          <Menu.Item
            active={activeItem === 'sessionHistory'}
            name="sessionHistory"
            onClick={() => Router.push('/sessions/')}
          >
            <FormattedMessage id="pages.sessionHistory.title" defaultMessage="Session History" />
          </Menu.Item>
          <Menu.Item
            active={activeItem === 'runningSession'}
            name="runningSession"
            onClick={() => Router.push('/sessions/running')}
          >
            <FormattedMessage id="pages.runningSession.title" defaultMessage="Running Session" />
          </Menu.Item>
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
