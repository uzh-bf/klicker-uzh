import Link from 'next/link'
import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Grid } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

import TeacherLayout from '../components/layouts/TeacherLayout'
import pageWithIntl from '../lib/pageWithIntl'

class Index extends Component {
  static propTypes = {
    head: PropTypes.node.isRequired,
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
    const navbarConfig = {
      accountShort: 'AW',
      search: {
        handleSearch: this.handleSearch,
        handleSort: this.handleSort,
        query: '',
      },
      title: 'Fragenpool',
    }

    return (
      <TeacherLayout navbar={navbarConfig}>
        <Grid padded columns="2">
          <Grid.Column>
            <FormattedMessage id="helloWorld" />
            <p>
              Searched {this.state.searched} times
            </p>
          </Grid.Column>
          <Grid.Column>
            <Link href="/questions">
              <a>To question list</a>
            </Link>
          </Grid.Column>
        </Grid>
      </TeacherLayout>
    )
  }
}

export default pageWithIntl(Index)
