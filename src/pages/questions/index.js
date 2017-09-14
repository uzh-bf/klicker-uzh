// @flow

import React, { Component } from 'react'
import Router from 'next/router'
import { Button } from 'semantic-ui-react'

import { pageWithIntl, withData } from '../../lib'

import QuestionList from '../../components/questions/QuestionList'
import TagList from '../../components/questions/TagList'
import TeacherLayout from '../../components/layouts/TeacherLayout'

class Index extends Component {
  props: {
    intl: $IntlShape,
  }

  state: {
    activeNewButton: boolean,
    activeTags: Array<string>,
    sidebarVisible: boolean,
  }

  constructor(props) {
    super(props)
    this.state = {
      activeNewButton: false,
      activeTags: [],
      sidebarVisible: false,
    }
  }

  // handling the state of the new course button
  // TODO: implement animated action button
  handleActiveNewButton = () => {
    // this.setState({ activeNewButton: !this.state.activeNewButton })
    Router.push('/questions/create')
  }

  // handle searching in the navbar search area
  handleSearch = (query: string) => {
    console.log(`Searched... for ${query}`)
  }

  // handle sorting via navbar search area
  handleSort = (by: string, order: string) => {
    console.log(`sorted by ${by} in ${order} order`)
  }

  // handle clicking on a tag in the tag list
  handleTagClick = (tagId: string) => {
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
        sortBy: '',
        sortOrder: '',
      },
      title: intl.formatMessage({
        defaultMessage: 'Question Pool',
        id: 'teacher.questionPool.title',
      }),
    }

    const actionButton: any = (
      <Button
        circular
        primary
        className={this.state.activeNewButton ? 'actionButton active' : 'actionButton'}
        icon="plus"
        size="huge"
        onClick={this.handleActiveNewButton}
      />
    )

    return (
      <TeacherLayout
        actionButton={actionButton}
        intl={intl}
        navbar={navbarConfig}
        pageTitle={intl.formatMessage({
          defaultMessage: 'Question Pool',
          id: 'teacher.questionPool.pageTitle',
        })}
        sidebar={{ activeItem: 'questionPool' }}
      >
        <div className="questionPool">
          <div className="tagList">
            <TagList activeTags={this.state.activeTags} handleTagClick={this.handleTagClick} />
          </div>
          <div className="questionList">
            <QuestionList />
          </div>
        </div>

        <style jsx>{`
          .questionPool {
            display: flex;
            flex-direction: column;

            padding: 1rem;
          }

          .tagList {
            flex: 1;

            margin-bottom: 1rem;
          }

          @media all and (min-width: 768px) {
            .questionPool {
              flex-direction: row;

              padding: 2rem;
            }

            .tagList {
              flex: 0 0 auto;

              margin: 0;
              margin-right: 2rem;
            }

            .questionList {
              flex: 1;
            }
          }

          @media all and (min-width: 991px) {
            .questionPool {
              padding: 2rem 10% 2rem 2rem;
            }
          }
        `}</style>
      </TeacherLayout>
    )
  }
}

export default withData(pageWithIntl(Index))
