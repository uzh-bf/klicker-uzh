// @flow

import React, { Component } from 'react'

import { pageWithIntl, withData } from '../../lib'

import TeacherLayout from '../../components/layouts/TeacherLayout'
import SessionList from '../../components/sessions/SessionList'

class Index extends Component {
  props: {
    intl: $IntlShape,
  }

  // handle searching in the navbar search area
  handleSearch = (query: string) => {
    console.log(`Searched... for ${query}`)
  }

  // handle sorting via navbar search area
  handleSort = (by: string, order: string) => {
    console.log(`sorted by ${by} in ${order} order`)
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
        defaultMessage: 'Session History',
        id: 'teacher.sessionHistory.title',
      }),
    }

    return (
      <TeacherLayout
        intl={intl}
        navbar={navbarConfig}
        pageTitle={intl.formatMessage({
          defaultMessage: 'Session History',
          id: 'teacher.sessionHistory.pageTitle',
        })}
        sidebar={{ activeItem: 'sessionHistory' }}
      >
        <div className="sessionHistory">
          <SessionList intl={intl} />
        </div>

        <style jsx>{`
          .sessionHistory {
            padding: 1rem .7rem;
          }

          @media all and (min-width: 768px) {
            .sessionHistory {
              padding: 2rem;
            }
          }

          @media all and (min-width: 991px) {
            .sessionHistory {
              padding: 2rem 10%;
            }
          }
        `}</style>
      </TeacherLayout>
    )
  }
}

export default withData(pageWithIntl(Index))
