import React from 'react'
import { PropTypes } from 'prop-types'

const Feedback = ({ content, vote }) => (
  <div>
    <div>{content}</div>
    <div>{vote}</div>
  </div>
)

Feedback.propTypes = {
  content: PropTypes.string.isRequired,
  vote: PropTypes.string.isRequired,
}

export default Feedback
