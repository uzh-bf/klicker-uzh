/* eslint-env jest */

import React from 'react'
import renderer from 'react-test-renderer'

import Settings from './settings'

describe('Snapshot-Testing', () => {
  it.skip('Works', () => {
    const component = renderer.create(<Settings />)
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
})
