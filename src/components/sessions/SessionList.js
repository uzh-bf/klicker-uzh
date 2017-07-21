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
        title: PropTypes.string.isRequired,
        createdAt: PropTypes.string.isRequired,
      }),
    ),
  }).isRequired,
}

export default graphql(
  gql`
    {
      allSessions {
        id
        title
        questions {
          id
        }
        createdAt
        updatedAt
      }
    }
  `,
)(SessionList)
