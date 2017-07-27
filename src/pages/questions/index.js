import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Grid } from 'semantic-ui-react'

import QuestionList from '../../components/questions/QuestionList'
import TagList from '../../components/questions/TagList'
import TeacherLayout from '../../components/layouts/TeacherLayout'
import pageWithIntl from '../../lib/pageWithIntl'
import withData from '../../lib/withData'

class Index extends Component {
  static propTypes = {
    intl: PropTypes.shape({
      formatMessage: PropTypes.func.isRequired,
    }).isRequired,
  }

  state = {
    activeTags: [],
    sidebarVisible: false,
  }

  // handle searching in the navbar search area
  handleSearch = () => {
    console.log('searched...')
  }

  // handling toggle of the sidebar via navbar
  handleSidebarToggle = () => {
    this.setState({ sidebarVisible: !this.state.sidebarVisible })
  }

  // handle sorting via navbar search area
  handleSort = () => {
    console.log('sorted...')
  }

  // handle clicking on a tag in the tag list
  handleTagClick = (tagId) => {
    this.setState((prevState) => {
      // remove the tag from active tags
      if (prevState.activeTags.includes(tagId)) {
        return {
          activeTags: prevState.activeTags.filter(tag => tag !== tagId),
        }
      }

      // add the tag to active tags
      return {
        activeTags: [...prevState.activeTags, tagId],
      }
    })
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
        defaultMessage: 'Question Pool',
        id: 'pages.questionPool.title',
      }),
    }

    return (
      <TeacherLayout intl={intl} navbar={navbarConfig} sidebar={{ activeItem: 'questionPool' }}>
        <Grid padded stackable>
          <Grid.Row>
            <Grid.Column stretched width="2">
              <TagList activeTags={this.state.activeTags} handleTagClick={this.handleTagClick} />
            </Grid.Column>
            <Grid.Column stretched width="12">
              <QuestionList />
            </Grid.Column>
            <Grid.Column stretched width="2" />
          </Grid.Row>
        </Grid>
      </TeacherLayout>
    )
  }
}

export default withData(pageWithIntl(Index))
