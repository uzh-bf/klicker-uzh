import React from 'react'
import { FormattedMessage } from 'react-intl'

const TitleInput = ({ input: { value, onChange } }) => (
  <div className="field">
    <label htmlFor="questionTitle">
      <FormattedMessage defaultMessage="Question title" id="teacher.createQuestion.questionTitle" />
    </label>
    <input name="questionTitle" type="text" value={value} onChange={onChange} />
  </div>
)

export default TitleInput
