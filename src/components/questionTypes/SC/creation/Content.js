// @flow

import React from 'react'
import { FormattedMessage } from 'react-intl'

type Props = {
  value: string,
  handleChange: (newValue: string) => void,
}

const Content = ({ input: { value, onChange } }: Props) => (
  <div className="field">
    <label htmlFor="content">
      <FormattedMessage defaultMessage="Content" id="teacher.createQuestion.content" />
    </label>
    <textarea name="content" value={value} onChange={onChange} />

    <style jsx>{`
      textarea {
        border: 1px solid lightgrey;
        height: 20rem;
        padding: 1rem;
      }
    `}</style>
  </div>
)

export default Content
