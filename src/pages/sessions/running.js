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
        id: 'pages.runningSession.title',
        defaultMessage: 'Running Session',
      }),
    }

    return (
      <TeacherLayout navbar={navbarConfig} sidebar={{ activeItem: 'runningSession' }}>
        <Grid padded columns="2">
          <Grid.Column>blebleble</Grid.Column>
          <Grid.Column>blablabla</Grid.Column>
        </Grid>
      </TeacherLayout>
    )
  }
}

export default pageWithIntl(Running)
