/* eslint-disable import/prefer-default-export */

import React from 'react'
import { SEMANTIC_VERSION } from '../../constants'

function createLinks(links = []) {
  return links.map(link => (
    <link
      href={
        link.substr(0, 4) === 'http'
          ? link
          : `https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/${SEMANTIC_VERSION}/components/${link}.min.css`
      }
      key={link}
      rel="stylesheet"
    />
  ))
}

export { createLinks }
