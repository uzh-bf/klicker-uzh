/* eslint-disable react/no-danger */

import React from 'react'
import PropTypes from 'prop-types'

import { toSanitizedHTML } from '../../lib'

const propTypes = {
  content: PropTypes.object.isRequired, // draftjs contentstate
  description: PropTypes.string.isRequired,
}

const QuestionDescription = ({ content, description }) => {
  // create the markup for "unsafe" display
  const createMarkup = () => ({
    __html: toSanitizedHTML(content) || description || null,
  })

  // return the content div with "unsafe" HTML
  return <div className="description" dangerouslySetInnerHTML={createMarkup()} />
}

QuestionDescription.propTypes = propTypes

export default QuestionDescription
