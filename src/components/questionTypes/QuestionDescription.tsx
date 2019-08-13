/* eslint-disable react/no-danger */

import React from 'react'

import { toSanitizedHTML } from '../../lib/utils/html'

interface Props {
  content: object | string
  description?: string
}

function QuestionDescription({ content, description }: Props): React.ReactElement {
  // create the markup for "unsafe" display
  const createMarkup: Function = (): any => ({ __html: toSanitizedHTML(content) || description || null })

  // return the content div with "unsafe" HTML
  return <div className="description" dangerouslySetInnerHTML={createMarkup()} />
}

export default QuestionDescription
