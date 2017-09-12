// @flow

import React from 'react'
import { FormattedMessage } from 'react-intl'

type Props = {
  value: string,
  onChange: (newValue: string) => void,
}
const TitleInput = ({ input: { value, onChange } }: Props) => (
  <div className="field">
    <label htmlFor="questionTitle">
      <FormattedMessage defaultMessage="Question title" id="teacher.createQuestion.questionTitle" />
    </label>
    <input name="questionTitle" type="text" value={value} onChange={onChange} />
  </div>
)

export default TitleInput
