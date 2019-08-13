/* eslint-disable import/prefer-default-export */

import React from 'react'

export function createLinks(links: string[] = []): React.ReactElement[] {
  return links.map((link): React.ReactElement => <link href={link} key={link} rel="stylesheet" />)
}
