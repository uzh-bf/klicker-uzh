import React from 'react'
import PropTypes from 'prop-types'

import { stateToHTML } from 'draft-js-export-html'

const propTypes = {
  description: PropTypes.object.isRequired, // draftjs contentstate
}

const QuestionDescription = ({ description }) => {
  let htmlContent
  try {
    htmlContent = stateToHTML(description)
  } catch (e) {
    console.error(e)
  }

  return <div className="description">{htmlContent || 'No content'}</div>
}

QuestionDescription.propTypes = propTypes

export default QuestionDescription
