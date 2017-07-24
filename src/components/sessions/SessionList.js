import React from 'react'
import PropTypes from 'prop-types'
import { gql, graphql } from 'react-apollo'

import Session from './Session'

const SessionList = ({ data }) =>
  (<div>
    {data.allSessions.map(session => <Session key={session.id} {...session} />)}
  </div>)


SessionList.propTypes = {
  data: PropTypes.shape({
    allSessions: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        createdAt: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        questions: PropTypes.shape({
          id: PropTypes.string.isRequired,
          description: PropTypes.string.isRequired,
          questionDefinition: PropTypes.shape({
            title: PropTypes.string.isRequired,
            type: PropTypes.string.isRequired,
          }).isRequired,
        }),
        status: PropTypes.string.isRequired,
      }),
    ),
  }).isRequired,
}

export default graphql(
  gql`
    {
      allSessions {
        createdAt
        id
        name
        questions {
          id
          description
          questionDefinition {
            title
            type
          }
        }
        status
        updatedAt
      }
    }
  `,
)(SessionList)
