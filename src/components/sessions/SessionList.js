import React from 'react'
import PropTypes from 'prop-types'
import { gql, graphql } from 'react-apollo'

import Session from './Session'

const SessionList = ({ data, intl }) =>
  (
    <div>
      {console.dir(data.allSessions)}
      {
        data.allSessions.map(session => (
          <Session
            createdAt={session.createdAt}
            id={session.id}
            intl={intl}
            name={session.name}
            sessionId={session.id.slice(0, -15)}
            status={session.status}
            updatedAt={session.updatedAt}
            blocks={session.blocks}
          />
          ),
        )
      }
    </div>
  )

SessionList.propTypes = {
  data: PropTypes.shape({
    allSessions: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        status: PropTypes.string.isRequired,
        blocks: PropTypes.arrayOf({
          id: PropTypes.string.isRequired,
          questions: PropTypes.shape({
            questionDefinition: PropTypes.shape({
              createdAt: PropTypes.string.isRequired,
              title: PropTypes.string.isRequired,
              type: PropTypes.string.isRequired,
            }).isRequired,
          }).isRequired,
        }).isRequired,
        createdAt: PropTypes.string.isRequired,
        updatedAt: PropTypes.string.isRequired,
      }),
    ),
  }).isRequired,
  intl: PropTypes.shape({
    formatMessage: PropTypes.func.isRequired,
  }),
}

SessionList.defaultProps = {
  intl: null,
}

export default graphql(
  gql`
    {
      allSessions {
        id
        name
        status
        blocks {
          id
          questions {
            questionDefinition {
              createdAt
              title
              type
            }
          }
        }
        createdAt
        updatedAt
      }
    }
  `,
)(SessionList)
