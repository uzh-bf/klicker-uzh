// @flow

/* eslint-disable import/prefer-default-export */

import React from 'react'

function createLinks(
  linksFull?: Array<string> = [],
  linksSemantic?: Array<string> = [],
): Array<any> {
  const links = [
    ...linksFull,
    ...linksSemantic.map(
      file =>
        `https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/2.2.11/components/${file}.min.css`,
    ),
  ]

  const elements = links.map(link => <link key={link} rel="stylesheet" href={link} />)

  return elements
}

export { createLinks }
