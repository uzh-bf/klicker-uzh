// @flow

import React from 'react'

const Content = ({ value, handleChange }) => (
  <textarea name="content" value={value} onChange={handleChange} />
)

export default Content
