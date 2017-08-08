// @flow

import React, { Component } from 'react'

import TeacherLayout from '../../components/layouts/TeacherLayout'
import pageWithIntl from '../../lib/pageWithIntl'
import SessionList from '../../components/sessions/SessionList'
import withData from '../../lib/withData'

class Index extends Component {
  props: {
    intl: $IntlShape,
  }

  handleSearch = () => {
    console.log('searched...')
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
        defaultMessage: 'Session History',
        id: 'teacher.sessionHistory.title',
      }),
    }

    return (
      <TeacherLayout intl={intl} navbar={navbarConfig} sidebar={{ activeItem: 'sessionHistory' }}>
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
