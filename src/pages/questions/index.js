import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Button, Grid } from 'semantic-ui-react'

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
    activeNewButton: false,
    activeTags: [],
    sidebarVisible: false,
  }

  // handling the state of the new course button
  handleActiveNewButton = () => {
    this.setState({ activeNewButton: !this.state.activeNewButton })
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
            <Grid.Column stretched textAlign="right" verticalAlign="bottom" width="2">
              {/* TODO correct position of button */}
              {this.state.activeNewButton &&
                <div>
                  <p>Session starten</p>
                  <p>Frage erstellen</p>
                </div>}
              <div>
                <Button
                  circular
                  primary
                  className={
                    this.state.activeNewButton ? 'actionButton actionButtonActive' : 'actionButton'
                  }
                  icon="plus"
                  size="large"
                  onClick={this.handleActiveNewButton}
                />
              </div>
            </Grid.Column>
          </Grid.Row>
        </Grid>

        <style jsx>{`
          :global(.actionButton) {
            border-radius: 10em !important;
          }
          :global(.actionButtonActive) {
            transition: transform 0.5s;
            transform: rotate(45deg);
          }
        `}</style>
      </TeacherLayout>
    )
  }
}

export default withData(pageWithIntl(Index))
