/* eslint-env jest */

import React from 'react'
import renderer from 'react-test-renderer'

import ResetPassword from './resetPassword'

describe('Snapshot-Testing', () => {
  it.skip('Works', () => {
    const component = renderer.create(<ResetPassword />)
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
})
