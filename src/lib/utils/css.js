/* eslint-disable import/prefer-default-export */

import React from 'react'

function createLinks(links = []) {
  return links.map(link => <link href={link} key={link} rel="stylesheet" />)
}

export { createLinks }
