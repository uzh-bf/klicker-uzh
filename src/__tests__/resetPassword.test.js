/* eslint-env jest */

import React from 'react'
import renderer from 'react-test-renderer'

import ResetPassword from '../pages/user/resetPassword'

describe('Snapshot-Testing', () => {
  it('Works', () => {
    const component = renderer.create(<ResetPassword />)
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
})
