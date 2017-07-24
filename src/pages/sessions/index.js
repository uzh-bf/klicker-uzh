import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Grid } from 'semantic-ui-react'

import TeacherLayout from '../../components/layouts/TeacherLayout'
import pageWithIntl from '../../lib/pageWithIntl'
import SessionList from '../../components/sessions/SessionList'
import withData from '../../lib/withData'
import GridColumn from 'semantic-ui-react/dist/es/collections/Grid/GridColumn'

class Index extends Component {
  static propTypes = {
    intl: PropTypes.shape({
      formatMessage: PropTypes.func.isRequired,
    }).isRequired,
  }

  state = {
    searched: 0,
    sidebarActive: 'pool',
    sidebarVisible: false,
  }

  handleSearch = () => {
    this.setState(prevState => ({
      searched: prevState.searched + 1,
    }))

    console.log('searched...')
  }

  handleSidebarToggle = () => {
    this.setState({ sidebarVisible: !this.state.sidebarVisible })
  }

  handleSort = () => {
    console.log('sorted...')
  }

  render() {
    const { intl } = this.props

    const navbarConfig = {
      accountShort: 'AW',
      search: {
        handleSearch: this.handleSearch,
        handleSort: this.handleSort,
        query: '',
      },
      title: intl.formatMessage({
        id: 'pages.sessionHistory.title',
        defaultMessage: 'Session History',
      }),
    }

    return (
      <TeacherLayout intl={intl} navbar={navbarConfig} sidebar={{ activeItem: 'sessionHistory' }}>
        <Grid padded stackable>
          <Grid.Row>
            <GridColumn width="2" />
            <Grid.Column width="12">
              <SessionList />
            </Grid.Column>
            <GridColumn width="2" />
          </Grid.Row>
        </Grid>
      </TeacherLayout>
    )
  }
}

export default withData(pageWithIntl(Index))
