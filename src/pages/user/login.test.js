/* eslint-env jest */

import React from 'react'
import renderer from 'react-test-renderer'

import Login from './login'

describe('Snapshot-Testing', () => {
  it.skip('Works', () => {
    const component = renderer.create(<Login />)
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
})
