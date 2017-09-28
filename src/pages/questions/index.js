// @flow

import React, { Component } from 'react'
import Router from 'next/router'
import { Button } from 'semantic-ui-react'
import _debounce from 'lodash/debounce'

import { pageWithIntl, withData } from '../../lib'

import QuestionList from '../../components/questions/QuestionList'
import TagList from '../../components/questions/TagList'
import TeacherLayout from '../../components/layouts/TeacherLayout'

import type { QuestionFilters } from '../../lib/utils/filters'

type Props = {
  intl: $IntlShape,
}

class Index extends Component {
  props: Props

  state: {
    activeNewButton: boolean,
    filters: QuestionFilters,
    sidebarVisible: boolean,
  }

  constructor(props) {
    super(props)
    this.state = {
      activeNewButton: false,
      filters: {
        tags: [],
        title: null,
        type: null,
      },
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
    this.setState(prevState => ({
      filters: {
        ...prevState.filters,
        title: query,
      },
    }))
  }

  // handle sorting via navbar search area
  handleSort = (by: string, order: string) => {
    console.log(`sorted by ${by} in ${order} order`)
  }

  // handle clicking on a tag in the tag list
  handleTagClick = (tagName: string) => {
    this.setState((prevState) => {
      // remove the tag from active tags
      if (prevState.filters.tags.includes(tagName)) {
        return {
          filters: {
            ...prevState.filters,
            tags: prevState.filters.tags.filter(tag => tag !== tagName),
          },
        }
      }

      // add the tag to active tags
      return {
        filters: {
          ...prevState.filters,
          tags: [...prevState.filters.tags, tagName],
        },
      }
    })
  }

  render() {
    const { intl } = this.props

    const navbarConfig = {
      accountShort: 'AW',
      search: {
        handleSearch: _debounce(this.handleSearch, 200),
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
            <TagList activeTags={this.state.filters.tags} handleTagClick={this.handleTagClick} />
          </div>
          <div className="questionList">
            <QuestionList filters={this.state.filters} />
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
