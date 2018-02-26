/* eslint-env jest */

import React from 'react'
import renderer from 'react-test-renderer'

import RequestPassword from '../pages/user/requestPassword'

describe('Snapshot-Testing', () => {
  it('Works', () => {
    const component = renderer.create(<RequestPassword />)
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
})
