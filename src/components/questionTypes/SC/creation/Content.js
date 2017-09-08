// @flow

import React from 'react'

type Props = {
  value: string,
  handleChange: (newValue: string) => void,
}

const Content = ({ value, handleChange }: Props) => (
  <textarea name="content" value={value} onChange={handleChange} />
)

export default Content
