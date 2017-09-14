// @flow

import React, { Component } from 'react'
import Router from 'next/router'
import _debounce from 'lodash/debounce'
import classNames from 'classnames'
import { FaPlus } from 'react-icons/lib/fa'

import { pageWithIntl, withData } from '../../lib'

import SessionCreationForm from '../../components/forms/SessionCreationForm'
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
    creationMode: boolean,
    filters: QuestionFilters,
    sidebarVisible: boolean,
  }

  constructor(props) {
    super(props)
    this.state = {
      creationMode: false,
      filters: {
        tags: [],
        title: null,
        type: null,
      },
      sidebarVisible: false,
    }
  }

  toggleCreationMode = (): void => {
    this.setState(prevState => ({ creationMode: !prevState.creationMode }))
  }

  // handle searching in the navbar search area
  handleSearch = (query: string): void => {
    this.setState(prevState => ({
      filters: {
        ...prevState.filters,
        title: query,
      },
    }))
  }

  // handle sorting via navbar search area
  handleSort = (by: string, order: string): void => {
    console.log(`sorted by ${by} in ${order} order`)
  }

  // handle clicking on a tag in the tag list
  handleTagClick = (tagName: string): void => {
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
      <div className="actionButton">
        <button
          className={classNames('ui huge circular primary icon button', {
            active: this.state.creationMode,
          })}
          onClick={this.toggleCreationMode}
        >
          <FaPlus />
        </button>
      </div>
    )

    const actionArea: any = (
      <div className="creationForm">
        <SessionCreationForm
          onSubmit={this.toggleCreationMode}
          onDiscard={this.toggleCreationMode}
        />

        <style jsx>{`
          .creationForm {
            animation-name: slide-in;
            animation-duration: 0.5s;
          }

          @keyframes slide-in {
            0% {
              transform: translateY(300px);
            }
            100% {
              transform: translateY(0);
            }
          }
        `}</style>
      </div>
    )

    return (
      <TeacherLayout
        actionArea={this.state.creationMode ? actionArea : actionButton}
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

          .actionButton {
            display: flex;
            flex-direction: row;
            justify-items: flex-end;
          }

          @media all and (min-width: 768px) {
            .questionPool {
              flex-flow: row wrap;

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
