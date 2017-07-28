import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Grid } from 'semantic-ui-react'

import TeacherLayout from '../../components/layouts/TeacherLayout'
import pageWithIntl from '../../lib/pageWithIntl'

class Running extends Component {
  static propTypes = {
    intl: PropTypes.shape({
      formatMessage: PropTypes.func.isRequired,
    }).isRequired,
  }

  handleSidebarToggle = () => {
    this.setState({ sidebarVisible: !this.state.sidebarVisible })
  }

  render() {
    const { intl } = this.props

    const navbarConfig = {
      accountShort: 'AW',
      title: intl.formatMessage({
        defaultMessage: 'Running Session',
        id: 'pages.runningSession.title',
      }),
    }

    return (
      <TeacherLayout intl={intl} navbar={navbarConfig} sidebar={{ activeItem: 'runningSession' }}>
        <Grid centered padded stackable><Grid.Row><Grid.Column width="12">Hello</Grid.Column></Grid.Row></Grid>
      </TeacherLayout>
    )
  }
}

export default pageWithIntl(Running)
