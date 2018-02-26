/* eslint-env jest */

import React from 'react'
import renderer from 'react-test-renderer'

import Login from '../pages/user/login'

describe('Snapshot-Testing', () => {
  it('Works', () => {
    const component = renderer.create(<Login />)
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
})
