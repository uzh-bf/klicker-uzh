// @flow

/* eslint-disable import/prefer-default-export */

import React from 'react'

function createLinks(links: Array<string> = []): Array<*> {
  return links.map(link => (
    <link
      key={link}
      rel="stylesheet"
      href={
        link.substr(0, 4) === 'http' ? (
          link
        ) : (
          `https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/2.2.11/components/${link}.min.css`
        )
      }
    />
  ))
}

export { createLinks }
