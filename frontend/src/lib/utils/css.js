/* eslint-disable import/prefer-default-export */

import React from 'react'

function createLinks(links = []) {
  return links.map(link => (
    <link
      href={
        link.substr(0, 4) === 'http'
          ? link
          : `https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/2.2.11/components/${link}.min.css`
      }
      key={link}
      rel="stylesheet"
    />
  ))
}

export { createLinks }
